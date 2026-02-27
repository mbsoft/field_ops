# Field Ops - GCP Cloud Run Deployment
# Usage:
#   make build                    # Build Docker image (linux/amd64)
#   make push                     # Push image to Artifact Registry
#   make plan                     # Terraform plan
#   make deploy                   # Terraform apply
#   make build push deploy        # Full deployment pipeline

PROJECT_ID   ?= $(shell gcloud config get-value project)
REGION       ?= us-central1
SERVICE_NAME ?= field-ops
IMAGE_TAG    ?= latest

REGISTRY_URL = $(REGION)-docker.pkg.dev/$(PROJECT_ID)/$(SERVICE_NAME)
IMAGE        = $(REGISTRY_URL)/$(SERVICE_NAME):$(IMAGE_TAG)

.PHONY: build push plan deploy destroy auth-docker

# Build Docker image targeting linux/amd64 (not Apple Silicon)
build:
	docker build --platform linux/amd64 -t $(IMAGE) .

# Authenticate Docker with Artifact Registry
auth-docker:
	gcloud auth configure-docker $(REGION)-docker.pkg.dev --quiet

# Push image to Artifact Registry
push: auth-docker
	docker push $(IMAGE)

# Terraform plan
plan:
	cd terraform && terraform init -upgrade && \
	terraform plan \
		-var="project_id=$(PROJECT_ID)" \
		-var="region=$(REGION)" \
		-var="service_name=$(SERVICE_NAME)" \
		-var="image_tag=$(IMAGE_TAG)"

# Terraform apply
deploy:
	cd terraform && terraform init -upgrade && \
	terraform apply \
		-var="project_id=$(PROJECT_ID)" \
		-var="region=$(REGION)" \
		-var="service_name=$(SERVICE_NAME)" \
		-var="image_tag=$(IMAGE_TAG)"

# Terraform destroy
destroy:
	cd terraform && terraform destroy \
		-var="project_id=$(PROJECT_ID)" \
		-var="region=$(REGION)" \
		-var="service_name=$(SERVICE_NAME)" \
		-var="image_tag=$(IMAGE_TAG)"
