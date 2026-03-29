from __future__ import annotations

from release_helpers import ROOT, get_node_command, print_step, run


def main() -> None:
    node = get_node_command()
    print_step("running lint")
    run(["python", "scripts/lint.py"], "lint")
    print_step("running typecheck")
    run(["python", "scripts/typecheck.py"], "typecheck")
    print_step("running tests")
    run(node + ["--test", "tests/utils.test.js"], "tests")
    print_step("building release zip")
    run(["python", "scripts/build_release.py"], "build")
    print("release validation ok")


if __name__ == "__main__":
    main()
