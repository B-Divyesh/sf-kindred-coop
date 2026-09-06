use crate::session::{self, Credentials, Room, Sessions};
use axum::{
    body::Body,
    extract::{ws::WebSocketUpgrade, Path, Query, State},
    http::{header, HeaderValue, Request, StatusCode},
    middleware::{self, Next},
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{
    collections::{HashMap, VecDeque},
    sync::Arc,
    time::{Duration, Instant},
};
use tokio::sync::{Mutex, RwLock};
use tower_http::{
    services::{ServeDir, ServeFile},
    set_header::SetResponseHeaderLayer,
    trace::TraceLayer,
};

#[derive(Clone)]
pub struct AppState {
    pub sessions: Sessions,
    request_times: Arc<Mutex<HashMap<String, VecDeque<Instant>>>>,
    billing_base: String,
    http: reqwest::Client,
}

impl AppState {
    pub fn new() -> anyhow::Result<Self> {
        let billing_base =
            std::env::var("BILLING_BASE").unwrap_or_else(|_| "https://api.sociobot.in".into());
        Self::new_with_billing(&billing_base)
    }

    fn new_with_billing(billing_base: &str) -> anyhow::Result<Self> {
        Ok(Self {
            sessions: Arc::new(RwLock::new(HashMap::new())),
            request_times: Arc::new(Mutex::new(HashMap::new())),
            billing_base: billing_base.trim_end_matches('/').to_owned(),
            http: reqwest::Client::builder()
                .timeout(Duration::from_secs(5))
                .build()?,
        })
    }

    async fn verify_license(&self, license: &str) -> Result<bool, ApiError> {
        if license.is_empty() || license.len() > 4_096 {
            return Ok(false);
        }
        let response = self
            .http
            .get(format!(
                "{}/api/v1/products/kindred-coop/verify",
                self.billing_base
            ))
            .query(&[("license", license)])
            .send()
            .await
            .map_err(|_| {
                ApiError(
                    StatusCode::SERVICE_UNAVAILABLE,
                    "License verification is unavailable. Try again in a moment.",
                )
            })?;
        if !response.status().is_success() {
            return Err(ApiError(
                StatusCode::SERVICE_UNAVAILABLE,
                "License verification is unavailable. Try again in a moment.",
            ));
        }
        let verdict = response.json::<LicenseVerdict>().await.map_err(|_| {
            ApiError(
                StatusCode::SERVICE_UNAVAILABLE,
                "License verification is unavailable. Try again in a moment.",
            )
        })?;
        Ok(verdict.valid)
    }
    async fn allow_request(&self, client: &str) -> bool {
        let mut times = self.request_times.lock().await;
        let now = Instant::now();
        let cutoff = now - Duration::from_secs(1);
        times.retain(|_, requests| {
            while requests.front().is_some_and(|time| *time < cutoff) {
                requests.pop_front();
            }
            !requests.is_empty()
        });
        let requests = times.entry(client.to_owned()).or_default();
        if requests.len() >= 40 {
            return false;
        }
        requests.push_back(now);
        true
    }
    pub fn spawn_cleanup(&self) {
        let sessions = self.sessions.clone();
        tokio::spawn(async move {
            let mut tick = tokio::time::interval(Duration::from_secs(30));
            loop {
                tick.tick().await;
                let current = session::now();
                let mut rooms = sessions.write().await;
                for room in rooms.values() {
                    if room.expires_at <= current {
                        let _ = room.tx.send(());
                    }
                }
                rooms.retain(|_, room| room.expires_at + 300 > current);
            }
        });
    }
}

pub fn router(state: AppState) -> Router {
    let dist = std::env::var("DIST_DIR").unwrap_or_else(|_| "dist".into());
    let fallback = ServeFile::new(format!("{dist}/index.html"));
    Router::new()
        .route("/health", get(health))
        .route("/api/sessions", post(create_session))
        .route("/api/sessions/{code}/join", post(join_session))
        .route("/api/sessions/{code}/unlock", post(unlock_session))
        .route("/api/sessions/{code}/ws", get(websocket))
        .fallback_service(ServeDir::new(dist).fallback(fallback))
        // Apply this at the router boundary so HTTP, WebSocket upgrade, and
        // every API route share the same forwarded-client policy. Health is
        // deliberately exempt so ingress probes cannot be throttled.
        .layer(middleware::from_fn_with_state(state.clone(), rate_limit))
        .layer(middleware::from_fn(cache_headers))
        .layer(SetResponseHeaderLayer::if_not_present(
            header::CONTENT_SECURITY_POLICY,
            HeaderValue::from_static("default-src 'self'; connect-src 'self' https://api.sociobot.in https://pilot-api.sociobot.in wss:; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'"),
        ))
        .layer(SetResponseHeaderLayer::if_not_present(
            header::X_CONTENT_TYPE_OPTIONS,
            HeaderValue::from_static("nosniff"),
        ))
        .layer(SetResponseHeaderLayer::if_not_present(
            header::REFERRER_POLICY,
            HeaderValue::from_static("no-referrer"),
        ))
        .layer(SetResponseHeaderLayer::if_not_present(
            header::X_FRAME_OPTIONS,
            HeaderValue::from_static("DENY"),
        ))
        .layer(SetResponseHeaderLayer::if_not_present(
            header::STRICT_TRANSPORT_SECURITY,
            HeaderValue::from_static("max-age=31536000; includeSubDomains"),
        ))
        .layer(SetResponseHeaderLayer::if_not_present(
            header::HeaderName::from_static("permissions-policy"),
            HeaderValue::from_static(
                "camera=(), microphone=(), geolocation=(), payment=(), browsing-topics=()",
            ),
        ))
        .layer(TraceLayer::new_for_http())
        .with_state(state)
}

fn client_ip(request: &Request<Body>) -> String {
    request
        .headers()
        .get("x-forwarded-for")
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.split(',').next())
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or("unknown")
        .to_owned()
}

async fn rate_limit(State(state): State<AppState>, request: Request<Body>, next: Next) -> Response {
    if request.uri().path() == "/health" || state.allow_request(&client_ip(&request)).await {
        return next.run(request).await;
    }

    let mut response = (
        StatusCode::TOO_MANY_REQUESTS,
        Json(json!({"error": "Too many requests. Wait a moment and try again."})),
    )
        .into_response();
    response
        .headers_mut()
        .insert(header::RETRY_AFTER, HeaderValue::from_static("1"));
    response
}

async fn cache_headers(request: Request<Body>, next: Next) -> Response {
    let path = request.uri().path().to_owned();
    let mut response = next.run(request).await;
    let known_page = matches!(path.as_str(), "/" | "/demo" | "/privacy" | "/terms")
        || path.starts_with("/assets/")
        || matches!(
            path.as_str(),
            "/icon.svg"
                | "/apple-touch-icon.png"
                | "/manifest.webmanifest"
                | "/robots.txt"
                | "/sitemap.xml"
                | "/sw.js"
                | "/health"
        )
        || path.starts_with("/api/");
    if !known_page && response.status() == StatusCode::OK {
        *response.status_mut() = StatusCode::NOT_FOUND;
    }
    let policy = if path.starts_with("/assets/") {
        "public, max-age=31536000, immutable"
    } else if path.starts_with("/api/") || path == "/health" {
        "no-store"
    } else {
        "no-cache, must-revalidate"
    };
    response
        .headers_mut()
        .insert(header::CACHE_CONTROL, HeaderValue::from_static(policy));
    response
}

async fn health() -> Json<Value> {
    Json(json!({"status":"ok", "build": option_env!("BUILD_SHA").unwrap_or("development")}))
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
struct CreateRequest {
    expiry_minutes: u64,
    license: Option<String>,
}

#[derive(Deserialize)]
struct LicenseVerdict {
    valid: bool,
}

async fn create_session(
    State(state): State<AppState>,
    Json(body): Json<CreateRequest>,
) -> Result<Json<Credentials>, ApiError> {
    if !matches!(body.expiry_minutes, 15 | 30 | 60) {
        return Err(ApiError(
            StatusCode::BAD_REQUEST,
            "Choose a 15, 30, or 60 minute room.",
        ));
    }
    // Browser cache is only presentation state; billing remains authoritative.
    let unlocked = match body.license.as_deref() {
        Some(license) => state.verify_license(license).await.unwrap_or(false),
        None => false,
    };
    let mut rooms = state.sessions.write().await;
    if rooms.len() >= 5_000 {
        return Err(ApiError(
            StatusCode::SERVICE_UNAVAILABLE,
            "The game server is busy. Try again soon.",
        ));
    }
    let room = loop {
        let candidate = Room::new(body.expiry_minutes, unlocked);
        if !rooms.contains_key(&candidate.code) {
            break candidate;
        }
    };
    let credentials = room.credentials("host", room.host_key.clone());
    rooms.insert(room.code.clone(), room);
    Ok(Json(credentials))
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct UnlockRequest {
    role: String,
    key: String,
    license: String,
}

#[derive(Serialize)]
struct UnlockResponse {
    unlocked: bool,
}

async fn unlock_session(
    State(state): State<AppState>,
    Path(raw_code): Path<String>,
    Json(body): Json<UnlockRequest>,
) -> Result<Json<UnlockResponse>, ApiError> {
    let code = raw_code.trim().to_uppercase();
    {
        let rooms = state.sessions.read().await;
        let room = rooms.get(&code).ok_or(ApiError(
            StatusCode::NOT_FOUND,
            "That room was not found. Ask the host for a fresh link.",
        ))?;
        if body.role != "host" || body.key != room.host_key {
            return Err(ApiError(
                StatusCode::UNAUTHORIZED,
                "Only this room's host can apply a family license.",
            ));
        }
    }
    if !state.verify_license(&body.license).await? {
        return Err(ApiError(
            StatusCode::FORBIDDEN,
            "This license is not active. Restore another license or continue with the free puzzle.",
        ));
    }
    let mut rooms = state.sessions.write().await;
    let room = rooms.get_mut(&code).ok_or(ApiError(
        StatusCode::NOT_FOUND,
        "That room was not found. Ask the host for a fresh link.",
    ))?;
    if body.key != room.host_key {
        return Err(ApiError(
            StatusCode::UNAUTHORIZED,
            "Only this room's host can apply a family license.",
        ));
    }
    room.unlocked = true;
    let _ = room.tx.send(());
    Ok(Json(UnlockResponse { unlocked: true }))
}

#[derive(Default, Deserialize)]
struct JoinRequest {
    key: Option<String>,
}

async fn join_session(
    State(state): State<AppState>,
    Path(raw_code): Path<String>,
    Json(body): Json<JoinRequest>,
) -> Result<Json<Credentials>, ApiError> {
    let code = raw_code.trim().to_uppercase();
    if code.len() != 7 || !code.chars().all(|c| c.is_ascii_alphanumeric()) {
        return Err(ApiError(
            StatusCode::BAD_REQUEST,
            "That invite code does not look right.",
        ));
    }
    let mut rooms = state.sessions.write().await;
    let room = rooms.get_mut(&code).ok_or(ApiError(
        StatusCode::NOT_FOUND,
        "That room was not found. Ask the host for a fresh link.",
    ))?;
    if room.expires_at <= session::now() {
        return Err(ApiError(
            StatusCode::GONE,
            "That room has expired. Ask the host to make a new one.",
        ));
    }
    let key = match (&room.guest_key, body.key) {
        (Some(existing), Some(given)) if *existing == given => existing.clone(),
        (Some(_), _) => {
            return Err(ApiError(
                StatusCode::CONFLICT,
                "This room already has two players.",
            ))
        }
        (None, _) => {
            let key = session::token(32);
            room.guest_key = Some(key.clone());
            key
        }
    };
    let _ = room.tx.send(());
    Ok(Json(room.credentials("guest", key)))
}

#[derive(Deserialize)]
struct WsQuery {
    role: String,
    key: String,
}

async fn websocket(
    State(state): State<AppState>,
    Path(raw_code): Path<String>,
    Query(query): Query<WsQuery>,
    ws: WebSocketUpgrade,
) -> Result<Response, ApiError> {
    let code = raw_code.to_uppercase();
    let rooms = state.sessions.read().await;
    let room = rooms
        .get(&code)
        .ok_or(ApiError(StatusCode::NOT_FOUND, "Room not found."))?;
    let valid = (query.role == "host" && query.key == room.host_key)
        || (query.role == "guest" && room.guest_key.as_deref() == Some(query.key.as_str()));
    if !valid {
        return Err(ApiError(
            StatusCode::UNAUTHORIZED,
            "This invite key is not valid.",
        ));
    }
    drop(rooms);
    let sessions = state.sessions.clone();
    Ok(ws.on_upgrade(move |socket| session::socket_loop(socket, sessions, code, query.role)))
}

struct ApiError(StatusCode, &'static str);
impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        (self.0, Json(json!({"error": self.1}))).into_response()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::{body::to_bytes, body::Body, extract::Query, http::Request};
    use tower::ServiceExt;

    async fn test_app() -> Router {
        router(AppState::new().unwrap())
    }

    #[tokio::test]
    async fn health_reports_ok() {
        let response = test_app()
            .await
            .oneshot(
                Request::builder()
                    .uri("/health")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn rejects_invalid_expiry() {
        let response = test_app()
            .await
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/sessions")
                    .header("content-type", "application/json")
                    .body(Body::from(r#"{"expiryMinutes":10}"#))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    }

    async fn mock_billing(Query(query): Query<HashMap<String, String>>) -> impl IntoResponse {
        match query.get("license").map(String::as_str) {
            Some("valid-family-license") => {
                (StatusCode::OK, Json(json!({"valid": true, "reason": "ok"})))
            }
            Some("unavailable-cached-license") => (
                StatusCode::SERVICE_UNAVAILABLE,
                Json(json!({"error": "offline"})),
            ),
            Some("revoked-family-license") => (
                StatusCode::OK,
                Json(json!({"valid": false, "reason": "revoked"})),
            ),
            _ => (
                StatusCode::OK,
                Json(json!({"valid": false, "reason": "invalid"})),
            ),
        }
    }

    async fn state_with_mock_billing() -> AppState {
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let address = listener.local_addr().unwrap();
        tokio::spawn(async move {
            axum::serve(listener, Router::new().fallback(get(mock_billing)))
                .await
                .unwrap();
        });
        AppState::new_with_billing(&format!("http://{address}")).unwrap()
    }

    async fn post(app: Router, uri: &str, json_body: &'static str) -> Response {
        app.oneshot(
            Request::builder()
                .method("POST")
                .uri(uri)
                .header("content-type", "application/json")
                .body(Body::from(json_body))
                .unwrap(),
        )
        .await
        .unwrap()
    }

    #[tokio::test]
    async fn rejects_browser_controlled_unlocked_flag() {
        let response = post(
            test_app().await,
            "/api/sessions",
            r#"{"expiryMinutes":15,"unlocked":true}"#,
        )
        .await;
        assert_eq!(response.status(), StatusCode::UNPROCESSABLE_ENTITY);
    }

    #[tokio::test]
    async fn only_valid_billing_verdict_unlocks_new_room() {
        for (token, expected) in [
            ("valid-family-license", true),
            ("forged-client-verdict", false),
            ("revoked-family-license", false),
            ("unavailable-cached-license", false),
        ] {
            let state = state_with_mock_billing().await;
            let app = router(state.clone());
            let body = format!(r#"{{"expiryMinutes":15,"license":"{token}"}}"#);
            let response = app
                .oneshot(
                    Request::builder()
                        .method("POST")
                        .uri("/api/sessions")
                        .header("content-type", "application/json")
                        .body(Body::from(body))
                        .unwrap(),
                )
                .await
                .unwrap();
            assert_eq!(response.status(), StatusCode::OK);
            assert_eq!(
                state
                    .sessions
                    .read()
                    .await
                    .values()
                    .next()
                    .unwrap()
                    .unlocked,
                expected
            );
        }
    }

    #[tokio::test]
    async fn room_unlock_requires_host_key_and_valid_license() {
        let state = state_with_mock_billing().await;
        let app = router(state.clone());
        let response = post(app.clone(), "/api/sessions", r#"{"expiryMinutes":15}"#).await;
        let bytes = to_bytes(response.into_body(), 8_192).await.unwrap();
        let credentials: Value = serde_json::from_slice(&bytes).unwrap();
        let code = credentials["code"].as_str().unwrap();
        let key = credentials["key"].as_str().unwrap();

        let invalid =
            format!(r#"{{"role":"host","key":"{key}","license":"revoked-family-license"}}"#);
        let response = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri(format!("/api/sessions/{code}/unlock"))
                    .header("content-type", "application/json")
                    .body(Body::from(invalid))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::FORBIDDEN);
        assert!(!state.sessions.read().await[code].unlocked);

        let valid = format!(r#"{{"role":"host","key":"{key}","license":"valid-family-license"}}"#);
        let response = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri(format!("/api/sessions/{code}/unlock"))
                    .header("content-type", "application/json")
                    .body(Body::from(valid))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::OK);
        assert!(state.sessions.read().await[code].unlocked);
    }

    #[tokio::test]
    async fn room_keys_do_not_cross_room_boundaries() {
        let state = AppState::new().unwrap();
        let first = Room::new(15, false);
        let first_code = first.code.clone();
        let first_guest_key = "FIRST-GUEST-KEY".to_owned();
        let mut first = first;
        first.guest_key = Some(first_guest_key.clone());

        let second = Room::new(15, false);
        let second_code = second.code.clone();
        let second_guest_key = "SECOND-GUEST-KEY".to_owned();
        let mut second = second;
        second.guest_key = Some(second_guest_key.clone());

        state
            .sessions
            .write()
            .await
            .extend([(first_code.clone(), first), (second_code, second)]);
        let app = router(state);

        let crossed = format!(r#"{{"key":"{second_guest_key}"}}"#);
        let response = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri(format!("/api/sessions/{first_code}/join"))
                    .header("content-type", "application/json")
                    .body(Body::from(crossed))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::CONFLICT);

        let response = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri(format!("/api/sessions/{first_code}/join"))
                    .header("content-type", "application/json")
                    .body(Body::from(format!(r#"{{"key":"{first_guest_key}"}}"#)))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn response_policy_covers_security_and_cache_headers() {
        let app = test_app().await;
        let health = app
            .clone()
            .oneshot(
                Request::builder()
                    .uri("/health")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(health.headers()[header::CACHE_CONTROL], "no-store");
        assert!(health
            .headers()
            .contains_key(header::STRICT_TRANSPORT_SECURITY));
        assert!(health.headers().contains_key("permissions-policy"));

        let shell = app
            .oneshot(Request::builder().uri("/").body(Body::empty()).unwrap())
            .await
            .unwrap();
        assert_eq!(
            shell.headers()[header::CACHE_CONTROL],
            "no-cache, must-revalidate"
        );

        for path in ["/sw.js", "/manifest.webmanifest"] {
            let response = test_app()
                .await
                .oneshot(Request::builder().uri(path).body(Body::empty()).unwrap())
                .await
                .unwrap();
            assert_eq!(
                response.headers()[header::CACHE_CONTROL],
                "no-cache, must-revalidate"
            );
        }
    }

    #[tokio::test]
    async fn unknown_page_returns_not_found_with_the_app_shell() {
        let response = test_app()
            .await
            .oneshot(
                Request::builder()
                    .uri("/this-page-does-not-exist")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::NOT_FOUND);
        assert_eq!(
            response.headers()[header::CACHE_CONTROL],
            "no-cache, must-revalidate"
        );
    }

    fn request(method: &str, uri: &str, client: &str) -> Request<Body> {
        Request::builder()
            .method(method)
            .uri(uri)
            .header("x-forwarded-for", client)
            .header("content-type", "application/json")
            .body(Body::from("{}"))
            .unwrap()
    }

    async fn exhaust_client(app: &Router, client: &str) {
        for _ in 0..40 {
            let response = app
                .clone()
                .oneshot(request("GET", "/privacy", client))
                .await
                .unwrap();
            assert_eq!(response.status(), StatusCode::OK);
        }
    }

    #[tokio::test]
    async fn rate_limit_uses_first_forwarded_hop_and_supplies_retry_after() {
        let app = test_app().await;
        let first_client = "198.51.100.7, 10.0.0.4";
        exhaust_client(&app, first_client).await;

        let limited = app
            .clone()
            .oneshot(request("GET", "/privacy", first_client))
            .await
            .unwrap();
        assert_eq!(limited.status(), StatusCode::TOO_MANY_REQUESTS);
        assert_eq!(limited.headers()[header::RETRY_AFTER], "1");

        let other_client = app
            .clone()
            .oneshot(request("GET", "/privacy", "203.0.113.9, 10.0.0.4"))
            .await
            .unwrap();
        assert_eq!(other_client.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn rate_limit_covers_every_route_but_not_health_checks() {
        for (method, uri) in [
            ("POST", "/api/sessions"),
            ("POST", "/api/sessions/ABCDEFG/join"),
            ("POST", "/api/sessions/ABCDEFG/unlock"),
            ("GET", "/api/sessions/ABCDEFG/ws?role=host&key=nope"),
            ("GET", "/privacy"),
        ] {
            let app = test_app().await;
            exhaust_client(&app, "192.0.2.55").await;
            let response = app
                .oneshot(request(method, uri, "192.0.2.55"))
                .await
                .unwrap();
            assert_eq!(response.status(), StatusCode::TOO_MANY_REQUESTS, "{uri}");
            assert_eq!(response.headers()[header::RETRY_AFTER], "1", "{uri}");
        }

        let app = test_app().await;
        for _ in 0..50 {
            let response = app
                .clone()
                .oneshot(request("GET", "/health", "192.0.2.88"))
                .await
                .unwrap();
            assert_eq!(response.status(), StatusCode::OK);
        }
    }

    #[tokio::test]
    async fn restart_drops_temporary_room_state() {
        let first = AppState::new().unwrap();
        let room = Room::new(15, false);
        first.sessions.write().await.insert(room.code.clone(), room);
        assert_eq!(first.sessions.read().await.len(), 1);
        drop(first);

        let restarted = AppState::new().unwrap();
        assert!(restarted.sessions.read().await.is_empty());
    }
}
