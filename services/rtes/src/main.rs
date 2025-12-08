use std::thread;
use std::time::Duration;

fn main() {
    println!("Hello, world! RTES service starting...");
    loop {
        thread::sleep(Duration::from_secs(60));
        println!("RTES service heartbeat");
    }
}
