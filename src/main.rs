mod app;
mod session;

use std::path::Path;
use std::{env, net::SocketAddr};
use tokio::signal;
use tracing::info;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .json()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info")),
        )
        .init();

    let port_source = if env::var_os("PORT").is_some() {
        "supplied"
    } else {
        "default"
    };
    let database_source = if env::var_os("DATABASE_URL").is_some() {
        "supplied"
    } else {
        "default"
    };
    let billing_source = if env::var_os("BILLING_BASE").is_some() {
        "supplied"
    } else {
        "default"
    };
    let port = env::var("PORT")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(8080);
    let default_database = if Path::new("/data").is_dir() {
        "sqlite:///data/kindred-v2.db?mode=rwc"
    } else {
        "sqlite://kindred.db?mode=rwc"
    };
    let state =
        app::AppState::new(&env::var("DATABASE_URL").unwrap_or_else(|_| default_database.into()))
            .await?;
    state.spawn_cleanup();
    let app = app::router(state);
    let address = SocketAddr::from(([0, 0, 0, 0], port));
    info!(
        %address,
        port_config = port_source,
        database_config = database_source,
        billing_config = billing_source,
        build = option_env!("BUILD_SHA").unwrap_or("development"),
        "kindred_coop_started"
    );
    let listener = tokio::net::TcpListener::bind(address).await?;
    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown())
        .await?;
    Ok(())
}

async fn shutdown() {
    let ctrl_c = async { signal::ctrl_c().await.expect("install ctrl-c handler") };
    #[cfg(unix)]
    let terminate = async {
        signal::unix::signal(signal::unix::SignalKind::terminate())
            .expect("install signal handler")
            .recv()
            .await;
    };
    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();
    tokio::select! { _ = ctrl_c => {}, _ = terminate => {} }
}
