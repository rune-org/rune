FROM golang:1.25-alpine AS builder

WORKDIR /app

COPY go.mod go.sum ./

RUN go mod download

RUN go mod verify

COPY . .

RUN CGO_ENABLED=0 GOOS=linux go build \
    -ldflags="-w -s" \
    -o worker \
    ./cmd/worker


FROM scratch

COPY --from=builder /app/worker /worker

ENTRYPOINT ["/worker"]
