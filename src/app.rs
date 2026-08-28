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
use serde::Deserialize;
use serde_json::{json, Value};
use sqlx::{sqlite::SqlitePoolOptions, SqlitePool};
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
    pub db: SqlitePool,
    request_times: Arc<Mutex<VecDeque<Instant>>>,
}

impl AppState {
    pub async fn new(database_url: &str) -> anyhow::Result<Self> {
        let db = SqlitePoolOptions::new()
            .max_connections(5)
            .connect(database_url)
            .await?;
        sqlx::query("CREATE TABLE IF NOT EXISTS page_views (day TEXT PRIMARY KEY, count INTEGER NOT NULL DEFAULT 0)").execute(&db).await?;
        Ok(Self {
            sessions: Arc::new(RwLock::new(HashMap::new())),
            db,
            request_times: Arc::new(Mutex::new(VecDeque::new())),
        })
    }
    async fn allow_room_request(&self) -> bool {
        let mut times = self.request_times.lock().await;
        let cutoff = Instant::now() - Duration::from_secs(60);
        while times.front().is_some_and(|time| *time < cutoff) {
            times.pop_front();
        }
        if times.len() >= 300 {
            return false;
        }
        times.push_back(Instant::now());
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
        .route("/api/page-view", post(page_view))
        .route("/api/sessions", post(create_session))
        .route("/api/sessions/{code}/join", post(join_session))
        .route("/api/sessions/{code}/ws", get(websocket))
        .fallback_service(ServeDir::new(dist).fallback(fallback))
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
        .layer(TraceLayer::new_for_http())
        .with_state(state)
}

async fn cache_headers(request: Request<Body>, next: Next) -> Response {
    let immutable = request.uri().path().starts_with("/assets/");
    let mut response = next.run(request).await;
    if immutable {
        response.headers_mut().insert(
            header::CACHE_CONTROL,
            HeaderValue::from_static("public, max-age=31536000, immutable"),
        );
    }
    response
}

async fn health() -> Json<Value> {
    Json(json!({"status":"ok", "build": option_env!("BUILD_SHA").unwrap_or("development")}))
}

async fn page_view(State(state): State<AppState>) -> StatusCode {
    let _ = sqlx::query("INSERT INTO page_views(day,count) VALUES(date('now'),1) ON CONFLICT(day) DO UPDATE SET count=count+1").execute(&state.db).await;
    StatusCode::NO_CONTENT
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct CreateRequest {
    expiry_minutes: u64,
    unlocked: Option<bool>,
}

async fn create_session(
    State(state): State<AppState>,
    Json(body): Json<CreateRequest>,
) -> Result<Json<Credentials>, ApiError> {
    if !state.allow_room_request().await {
        return Err(ApiError(
            StatusCode::TOO_MANY_REQUESTS,
            "Too many room requests. Wait a minute and try again.",
        ));
    }
    if !matches!(body.expiry_minutes, 15 | 30 | 60) {
        return Err(ApiError(
            StatusCode::BAD_REQUEST,
            "Choose a 15, 30, or 60 minute room.",
        ));
    }
    let mut rooms = state.sessions.write().await;
    if rooms.len() >= 5_000 {
        return Err(ApiError(
            StatusCode::SERVICE_UNAVAILABLE,
            "All lanterns are busy. Try again soon.",
        ));
    }
    let room = loop {
        let candidate = Room::new(body.expiry_minutes, body.unlocked.unwrap_or(false));
        if !rooms.contains_key(&candidate.code) {
            break candidate;
        }
    };
    let credentials = room.credentials("host", room.host_key.clone());
    rooms.insert(room.code.clone(), room);
    Ok(Json(credentials))
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
    if !state.allow_room_request().await {
        return Err(ApiError(
            StatusCode::TOO_MANY_REQUESTS,
            "Too many room requests. Wait a minute and try again.",
        ));
    }
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
    use axum::{body::Body, http::Request};
    use tower::ServiceExt;

    async fn test_app() -> Router {
        router(AppState::new("sqlite::memory:").await.unwrap())
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
}
