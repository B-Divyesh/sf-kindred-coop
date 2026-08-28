use axum::extract::ws::{Message, WebSocket};
use futures_util::{SinkExt, StreamExt};
use rand::{distr::Alphanumeric, Rng};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{
    collections::HashMap,
    sync::Arc,
    time::{SystemTime, UNIX_EPOCH},
};
use tokio::sync::{broadcast, RwLock};

pub type Sessions = Arc<RwLock<HashMap<String, Room>>>;

#[derive(Clone)]
pub struct Room {
    pub code: String,
    pub host_key: String,
    pub guest_key: Option<String>,
    pub expires_at: u64,
    pub puzzle: usize,
    pub entries: Vec<String>,
    pub attempts: u8,
    pub solved: bool,
    pub complete: bool,
    pub unlocked: bool,
    pub host_connected: bool,
    pub guest_connected: bool,
    pub last_signal: Option<String>,
    pub tx: broadcast::Sender<()>,
}

#[derive(Debug, Deserialize)]
pub struct ClientMessage {
    #[serde(rename = "type")]
    pub kind: String,
    pub value: Option<String>,
    #[serde(rename = "expiryMinutes")]
    pub expiry_minutes: Option<u64>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Credentials {
    pub code: String,
    pub role: String,
    pub key: String,
    pub expires_at: u64,
}

pub fn token(length: usize) -> String {
    rand::rng()
        .sample_iter(Alphanumeric)
        .take(length)
        .map(char::from)
        .collect::<String>()
        .to_uppercase()
}

pub fn now() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

pub fn solution(index: usize) -> &'static [&'static str] {
    match index {
        0 => &["moon", "leaf", "star", "ripple"],
        1 => &["right", "down", "right", "up"],
        _ => &["crescent", "fern", "amber"],
    }
}

impl Room {
    pub fn new(minutes: u64, unlocked: bool) -> Self {
        let (tx, _) = broadcast::channel(32);
        Self {
            code: token(7),
            host_key: token(32),
            guest_key: None,
            expires_at: now() + minutes * 60,
            puzzle: 0,
            entries: vec![],
            attempts: 0,
            solved: false,
            complete: false,
            unlocked,
            host_connected: false,
            guest_connected: false,
            last_signal: None,
            tx,
        }
    }

    pub fn credentials(&self, role: &str, key: String) -> Credentials {
        Credentials {
            code: self.code.clone(),
            role: role.into(),
            key,
            expires_at: self.expires_at,
        }
    }

    pub fn snapshot(&self, role: &str) -> Value {
        let expired = self.expires_at <= now();
        let status = if expired {
            "expired"
        } else if self.complete {
            "complete"
        } else if self.solved {
            "solved"
        } else if self.puzzle > 0 && !self.unlocked {
            "locked"
        } else if self.guest_key.is_none() {
            "waiting"
        } else {
            "playing"
        };
        let puzzle_names = [
            "Moonbeam message",
            "Stepping-stone trail",
            "Moth field notes",
        ];
        let role_note = if role == "host" {
            match self.puzzle {
                0 => "Send the four marks in the printed order. Your partner will echo each one.",
                1 => "Guide your partner around the bramble: right, down, right, then up.",
                _ => "Send the three field marks that identify your moth: crescent, fern, amber.",
            }
        } else {
            match self.puzzle {
                0 => "Watch for each mark from your Lantern, then tap the matching mark.",
                1 => "Follow your Lantern's direction one step at a time.",
                _ => "Collect the three field marks your Lantern sends.",
            }
        };
        json!({
            "type": "state", "code": self.code, "role": role, "status": status,
            "puzzle": self.puzzle, "puzzleName": puzzle_names[self.puzzle.min(2)],
            "roleNote": role_note, "entries": self.entries, "attempts": self.attempts,
            "step": self.entries.len(), "totalSteps": solution(self.puzzle).len(),
            "lastSignal": self.last_signal, "hostConnected": self.host_connected,
            "guestConnected": self.guest_connected, "expiresAt": self.expires_at,
            "unlocked": self.unlocked
        })
    }
}

pub async fn socket_loop(socket: WebSocket, sessions: Sessions, code: String, role: String) {
    let mut receiver = {
        let mut rooms = sessions.write().await;
        let Some(room) = rooms.get_mut(&code) else {
            return;
        };
        if role == "host" {
            room.host_connected = true
        } else {
            room.guest_connected = true
        }
        let _ = room.tx.send(());
        room.tx.subscribe()
    };
    let (mut writer, mut reader) = socket.split();
    if send_snapshot(&mut writer, &sessions, &code, &role)
        .await
        .is_err()
    {
        return;
    }

    loop {
        tokio::select! {
            incoming = reader.next() => match incoming {
                Some(Ok(Message::Text(text))) => {
                    if let Ok(message) = serde_json::from_str::<ClientMessage>(&text) {
                        handle_message(&sessions, &code, &role, message).await;
                    }
                }
                Some(Ok(Message::Close(_))) | None | Some(Err(_)) => break,
                _ => {}
            },
            changed = receiver.recv() => {
                if changed.is_err() || send_snapshot(&mut writer, &sessions, &code, &role).await.is_err() { break; }
            }
        }
    }
    let mut rooms = sessions.write().await;
    if let Some(room) = rooms.get_mut(&code) {
        if role == "host" {
            room.host_connected = false
        } else {
            room.guest_connected = false
        }
        let _ = room.tx.send(());
    }
}

async fn send_snapshot(
    writer: &mut futures_util::stream::SplitSink<WebSocket, Message>,
    sessions: &Sessions,
    code: &str,
    role: &str,
) -> Result<(), ()> {
    let payload = sessions
        .read()
        .await
        .get(code)
        .map(|room| room.snapshot(role))
        .ok_or(())?;
    writer
        .send(Message::Text(payload.to_string().into()))
        .await
        .map_err(|_| ())
}

async fn handle_message(sessions: &Sessions, code: &str, role: &str, message: ClientMessage) {
    let mut rooms = sessions.write().await;
    let Some(room) = rooms.get_mut(code) else {
        return;
    };
    if room.expires_at <= now() || room.complete {
        return;
    }
    match (role, message.kind.as_str()) {
        ("host", "signal") if !room.solved => {
            if let Some(value) = message.value.filter(|v| valid_value(v)) {
                room.last_signal = Some(value);
            }
        }
        ("guest", "answer") if !room.solved => {
            if let Some(value) = message.value.filter(|v| valid_value(v)) {
                let expected = solution(room.puzzle).get(room.entries.len()).copied();
                if expected == Some(value.as_str()) {
                    room.entries.push(value);
                    if room.entries.len() == solution(room.puzzle).len() {
                        room.solved = true;
                    }
                } else {
                    room.entries.clear();
                    room.attempts = room.attempts.saturating_add(1);
                }
            }
        }
        ("host", "next") if room.solved => {
            if room.puzzle == 0 && !room.unlocked {
                room.puzzle = 1;
                room.solved = false;
            } else if room.puzzle < 2 {
                room.puzzle += 1;
                room.entries.clear();
                room.solved = false;
                room.last_signal = None;
            } else {
                room.complete = true;
            }
        }
        ("host", "extend") => {
            if let Some(minutes @ (15 | 30 | 60)) = message.expiry_minutes {
                room.expires_at = now() + minutes * 60;
            }
        }
        ("host", "end") => room.expires_at = now(),
        _ => {}
    }
    let _ = room.tx.send(());
}

fn valid_value(value: &str) -> bool {
    matches!(
        value,
        "moon"
            | "leaf"
            | "star"
            | "ripple"
            | "up"
            | "down"
            | "left"
            | "right"
            | "crescent"
            | "fern"
            | "amber"
            | "speckle"
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn token_has_requested_length() {
        assert_eq!(token(7).len(), 7);
    }
    #[test]
    fn puzzle_solutions_are_bounded() {
        assert_eq!(solution(0).len(), 4);
        assert_eq!(solution(2).len(), 3);
    }
    #[test]
    fn rejects_arbitrary_messages() {
        assert!(!valid_value("<script>"));
    }

    #[tokio::test]
    async fn websocket_unlock_message_cannot_grant_paid_access() {
        let sessions: Sessions = Arc::new(RwLock::new(HashMap::new()));
        let room = Room::new(15, false);
        let code = room.code.clone();
        sessions.write().await.insert(code.clone(), room);
        handle_message(
            &sessions,
            &code,
            "host",
            ClientMessage {
                kind: "unlock".into(),
                value: None,
                expiry_minutes: None,
            },
        )
        .await;
        assert!(!sessions.read().await[&code].unlocked);
    }
}
