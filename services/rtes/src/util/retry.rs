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

#[cfg(test)]
mod tests {
    use std::sync::{
        Arc,
        atomic::{AtomicUsize, Ordering},
    };

    use super::with_backoff;

    #[tokio::test]
    async fn retries_until_operation_succeeds() {
        let attempts = Arc::new(AtomicUsize::new(0));
        let attempts_for_closure = attempts.clone();

        let result: Result<u32, &'static str> = with_backoff(
            move || {
                let attempt = attempts_for_closure.fetch_add(1, Ordering::SeqCst);
                async move { if attempt < 2 { Err("transient") } else { Ok(7) } }
            },
            "retry_test",
        )
        .await;

        assert_eq!(result.expect("third attempt should succeed"), 7);
        assert_eq!(attempts.load(Ordering::SeqCst), 3);
    }

    #[tokio::test]
    async fn returns_error_after_max_attempts() {
        let attempts = Arc::new(AtomicUsize::new(0));
        let attempts_for_closure = attempts.clone();

        let result: Result<u32, &'static str> = with_backoff(
            move || {
                attempts_for_closure.fetch_add(1, Ordering::SeqCst);
                async move { Err("still failing") }
            },
            "retry_test",
        )
        .await;

        assert_eq!(result.expect_err("operation should fail"), "still failing");
        assert_eq!(attempts.load(Ordering::SeqCst), 5);
    }
}
