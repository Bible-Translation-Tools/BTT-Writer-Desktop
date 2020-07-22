.PHONY: build run attach stop

IMAGE_LABEL := bw-local-dev
VOLUME_LABEL := $(IMAGE_LABEL)-volume

build:
	docker build . -t bw-local-dev

run:
	if [ -z "$$DISPLAY" ]; then echo "ERROR: DISPLAY var not set."; exit 1; fi; \
	docker run --rm --volume $(VOLUME_LABEL):/root --env DISPLAY="${DISPLAY}" -t $(IMAGE_LABEL)

attach:
	# Attaches to a running BW container
	CONTAINER_ID=$$(docker ps --filter ancestor=$(IMAGE_LABEL) --format '{{.Names}}'); \
	if [ -z "$$CONTAINER_ID" ]; then echo "ERROR: No running container found."; exit 1; fi; \
	docker exec -it $$CONTAINER_ID /bin/bash

stop:
	# Attaches to a running BW container
	CONTAINER_ID=$$(docker ps --filter ancestor=$(IMAGE_LABEL) --format '{{.Names}}'); \
	if [ -z "$$CONTAINER_ID" ]; then echo "ERROR: No running container found."; exit 1; fi; \
	docker stop $$CONTAINER_ID

