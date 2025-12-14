use std::{future::Future, time::Duration};

use tokio::time::sleep;
use tracing::warn;

/// Retry an async closure with exponential backoff (250ms base) up to five
/// attempts.
pub(crate) async fn with_backoff<F, Fut, T, E>(mut f: F, label: &'static str) -> Result<T, E>
where
    F: FnMut() -> Fut,
    Fut: Future<Output = Result<T, E>>,
{
    let mut backoff = Duration::from_millis(250);
    let max_attempts = 5;

    for attempt in 1..=max_attempts {
        match f().await {
            Ok(value) => return Ok(value),
            Err(err) if attempt == max_attempts => return Err(err),
            Err(_) => {
                warn!(
                    label,
                    attempt,
                    backoff_ms = backoff.as_millis(),
                    "operation failed, retrying with backoff"
                );
                sleep(backoff).await;
                backoff = backoff.saturating_mul(2);
            },
        }
    }
    unreachable!()
}

/// Retry the provided async block with exponential backoff. The macro expands
/// into a future that resolves to the borrowed block result, so the caller must
/// `.await` it.
///
/// Example:
/// ```ignore
/// retry_backoff!("status_update", { some_async_operation().await })?.await;
/// ```
#[macro_export]
macro_rules! retry_backoff {
    ($label:expr, $body:block) => {
        $crate::util::retry::with_backoff(|| async move $body, $label)
    };
}
