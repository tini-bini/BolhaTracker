from __future__ import annotations

from release_helpers import ROOT, get_npm_command, print_step, run


def main() -> None:
    npm = get_npm_command()
    print_step("running lint")
    run(["python", "scripts/lint.py"], "lint")
    print_step("running typecheck")
    run(["python", "scripts/typecheck.py"], "typecheck")
    print_step("running unit tests")
    run(npm + ["run", "test:unit"], "unit tests")
    print_step("running smoke tests")
    run(npm + ["run", "test:smoke"], "smoke tests")
    print_step("running end-to-end tests")
    run(npm + ["run", "test:e2e"], "end-to-end tests")
    print_step("building release zip")
    run(["python", "scripts/build_release.py"], "build")
    print("release validation ok")


if __name__ == "__main__":
    main()
