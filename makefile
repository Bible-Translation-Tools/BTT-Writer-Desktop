.PHONY: build run

build:
	docker build . -t bw-local-dev

run:
	docker run --rm --env DISPLAY="${DISPLAY}" -t bw-local-dev

