FROM ubuntu:22.04

# Prevent interactive prompts during build
ENV DEBIAN_FRONTEND=noninteractive

# System dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    pkg-config \
    libssl-dev \
    libudev-dev \
    curl \
    git \
    libclang-dev \
    llvm \
    clang \
    cmake \
    jq \
    && rm -rf /var/lib/apt/lists/*

# Install Rust
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
ENV PATH="/root/.cargo/bin:${PATH}"

# Install Solana CLI (1.18.12)
RUN sh -c "$(curl -sSfL https://release.solana.com/v1.18.12/install)"
ENV PATH="/root/.local/share/solana/install/active_release/bin:${PATH}"

# Install Anchor CLI (0.30.0) via AVM
RUN cargo install --git https://github.com/coral-xyz/anchor avm --locked
RUN avm install 0.30.0
RUN avm use 0.30.0

# Install Node.js (v20) and Yarn
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && npm install -g yarn

# Set workspace
WORKDIR /app

# Final environment variables
ENV ANCHOR_VERSION=0.30.0
ENV SOLANA_VERSION=1.18.12

# Default command
CMD ["anchor", "build"]
