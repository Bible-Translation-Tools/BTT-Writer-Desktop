.PHONY: edit build rebuild run attach stop clean

IMAGE_LABEL := bw-local-dev
VOLUME_LABEL := $(IMAGE_LABEL)-volume

edit:
	# Edits common files in your favorite editor
	$(EDITOR) makefile Dockerfile src/js/*.js src/views/*.html src/elements/**/*.html src/css/*.css

build:
	# Builds image
	docker build --tag bw-local-dev .

rebuild:
	# Re-builds image from scratch (takes a while!)
	docker build --no-cache --tag bw-local-dev .

run:
	# Starts BTT-Writer in a container.  The user directory is in a volume.
	# Run detached to prevent messing up the tty.
	# (Use `make stop` to end the program early.)
	if [ -z "$$DISPLAY" ]; then echo "ERROR: DISPLAY var not set."; exit 1; fi; \
	docker run --detach --rm --volume $(VOLUME_LABEL):/root --env DISPLAY="${DISPLAY}" $(IMAGE_LABEL)

logs:
	# Displays recent logs from running app
	CONTAINER_ID=$$(docker ps --filter ancestor=$(IMAGE_LABEL) --format '{{.Names}}'); \
	if [ -z "$$CONTAINER_ID" ]; then echo "ERROR: No running container found."; exit 1; fi; \
	docker logs $$CONTAINER_ID

logs-follow:
	# Displays and follows recent logs from running app
	CONTAINER_ID=$$(docker ps --filter ancestor=$(IMAGE_LABEL) --format '{{.Names}}'); \
	if [ -z "$$CONTAINER_ID" ]; then echo "ERROR: No running container found."; exit 1; fi; \
	docker logs --follow $$CONTAINER_ID

attach:
	# Attaches to the running BW container
	CONTAINER_ID=$$(docker ps --filter ancestor=$(IMAGE_LABEL) --format '{{.Names}}'); \
	if [ -z "$$CONTAINER_ID" ]; then echo "ERROR: No running container found."; exit 1; fi; \
	docker exec --interactive --tty $$CONTAINER_ID /bin/bash

stop:
	# Stops the running BW container
	CONTAINER_ID=$$(docker ps --filter ancestor=$(IMAGE_LABEL) --format '{{.Names}}'); \
	if [ -z "$$CONTAINER_ID" ]; then echo "ERROR: No running container found."; exit 1; fi; \
	docker stop $$CONTAINER_ID

clean:
	# Removes volume
	docker volume rm $(VOLUME_LABEL)
