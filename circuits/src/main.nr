fn main(x: Field, y: pub Field) {
    assert(x * x == y);
}

#[test]
fn test_main() {
    main(3, 9);
}
