.PHONY: edit build rebuild run logs logs-follow attach stop test clean release

IMAGE_LABEL := bw-local-dev
VOLUME_LABEL := $(IMAGE_LABEL)-volume
CONTAINER_ID := $(shell docker ps --filter ancestor=$(IMAGE_LABEL) --format '{{.Names}}')
RELEASE_DIR := $(HOME)/btt-writer-release

edit:
	# Edits common files in your favorite editor
	$(EDITOR) makefile Dockerfile src/js/*.js src/views/*.html src/elements/**/*.html src/css/*.css

build:
	# Builds image
	docker build --tag $(IMAGE_LABEL) .

rebuild:
	# Re-builds image from scratch (takes a while!)
	docker build --no-cache --tag $(IMAGE_LABEL) .

run:
	# Starts BTT-Writer in a container. Volume persists user data.
	# Runs detached to prevent messing up the tty.  Use 'make stop' to end if needed.
	# If on WSL: $$DISPLAY should be set to your X display manager, e.g. '192.168.3.3:0.0'
	# If you see a blank window: You may need to call 'xhost +' before launching the app.
	test $(DISPLAY) # If blank, then $$DISPLAY is not set
	test ! $(CONTAINER_ID) # If not blank, then container is already running
	docker run --detach --rm --net=host --ipc=host \
	           --volume="${XAUTHORITY}:/root/.Xauthority:rw" \
	           --volume $(VOLUME_LABEL):/root \
	           --env DISPLAY="${DISPLAY}" $(IMAGE_LABEL)

logs:
	# Displays recent logs from running app
	test $(CONTAINER_ID) # If blank, then container isn't running
	docker logs $(CONTAINER_ID)

logs-follow:
	# Displays and follows recent logs from running app
	test $(CONTAINER_ID) # If blank, then container isn't running
	docker logs --follow $(CONTAINER_ID)

attach:
	# Attaches to the running BW container
	test $(CONTAINER_ID) # If blank, then container isn't running
	docker exec --interactive --tty $(CONTAINER_ID) bash

stop:
	# Stops the running BW container
	test $(CONTAINER_ID) # If blank, then container isn't running
	docker stop $(CONTAINER_ID)

test:
	# Runs tests in the container
	# TODO: Determine why tests sometimes fail -- timing issue?
	test ! $(CONTAINER_ID) # If not blank, then container is already running
	docker run --interactive --tty --rm $(IMAGE_LABEL) bash -c "gulp test"

clean:
	# Removes volume
	docker volume rm $(VOLUME_LABEL)

release:
	# Creates executables
	docker run --rm --volume $(RELEASE_DIR):/app/release $(IMAGE_LABEL) bash -c "gulp build && gulp release"

release-win:
	# Creates Windows executable
	docker run --rm --volume $(RELEASE_DIR):/app/release $(IMAGE_LABEL) bash -c "gulp build --win && gulp release"

release-linux:
	# Creates Linux executable
	docker run --rm --volume $(RELEASE_DIR):/app/release $(IMAGE_LABEL) bash -c "gulp build --linux && gulp release"

release-osx:
	# Creates MacOs executable
	docker run --rm --volume $(RELEASE_DIR):/app/release $(IMAGE_LABEL) bash -c "gulp build --osx && gulp release"
