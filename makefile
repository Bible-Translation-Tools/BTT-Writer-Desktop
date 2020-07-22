.PHONY: build rebuild run attach stop

IMAGE_LABEL := bw-local-dev
VOLUME_LABEL := $(IMAGE_LABEL)-volume

build:
	# Builds image
	docker build --tag bw-local-dev .

rebuild:
	# Re-builds image from scratch (takes a while!)
	docker build --no-cache --tag bw-local-dev .

run:
	# Starts BTT-Writer in a container.  The user directory is in a volume.
	if [ -z "$$DISPLAY" ]; then echo "ERROR: DISPLAY var not set."; exit 1; fi; \
	docker run --rm --volume $(VOLUME_LABEL):/root --env DISPLAY="${DISPLAY}" -t $(IMAGE_LABEL)

attach:
	# Attaches to the running BW container
	CONTAINER_ID=$$(docker ps --filter ancestor=$(IMAGE_LABEL) --format '{{.Names}}'); \
	if [ -z "$$CONTAINER_ID" ]; then echo "ERROR: No running container found."; exit 1; fi; \
	docker exec -it $$CONTAINER_ID /bin/bash

stop:
	# Stops the running BW container
	CONTAINER_ID=$$(docker ps --filter ancestor=$(IMAGE_LABEL) --format '{{.Names}}'); \
	if [ -z "$$CONTAINER_ID" ]; then echo "ERROR: No running container found."; exit 1; fi; \
	docker stop $$CONTAINER_ID

clean:
	# Removes volume
	docker volume rm $(VOLUME_LABEL)
