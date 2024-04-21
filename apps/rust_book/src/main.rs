struct User {
    name: String,
    active: bool,
    age: u32,
}

fn main() {
    let user = User {
        name: String::from("John"),
        active: true,
        age: 30,
    };
    println!("Hello, world!");
}

