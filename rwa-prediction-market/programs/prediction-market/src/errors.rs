use anchor_lang::prelude::*;

#[error_code]
pub enum MarketError {
    #[msg("Market expiry must be at least 1 hour in the future")]
    ExpiryTooSoon,
    #[msg("Market has already been resolved")]
    AlreadyResolved,
    #[msg("Market has not been resolved yet")]
    NotResolved,
    #[msg("Market has expired — no new bets allowed")]
    MarketExpired,
    #[msg("Market has not expired yet — cannot resolve")]
    MarketNotExpired,
    #[msg("Pyth price is stale — publish_time too old")]
    PriceStale,
    #[msg("Pyth price confidence interval too wide — price uncertain")]
    PriceUncertain,
    #[msg("Pyth price feed status is not Trading")]
    PriceNotTrading,
    #[msg("Too early to sample price — outside TWAP window")]
    TooEarlyToSample,
    #[msg("Already sampled this slot — wait for next slot")]
    AlreadySampledThisSlot,
    #[msg("No TWAP samples collected — cannot resolve")]
    NoTwapSamples,
    #[msg("Bet amount must be greater than zero")]
    ZeroAmount,
    #[msg("Position already claimed")]
    AlreadyClaimed,
    #[msg("You did not win this market")]
    NotWinner,
    #[msg("Private market requires room access — pay entry fee first")]
    RoomAccessRequired,
    #[msg("Invalid side — must be 1 (YES) or 2 (NO)")]
    InvalidSide,
    #[msg("Arithmetic overflow")]
    Overflow,
    #[msg("Market title too long — max 100 chars")]
    MarketIdentifierTooLong,
    #[msg("Strike price must be positive")]
    InvalidPrice,
    #[msg("Market is not private — entry fee unnecessary")]
    MarketNotPrivate,
    #[msg("Insufficient TWAP samples — wait for more price updates")]
    InsufficientSamples,
    #[msg("Invalid Pyth price feed account provided")]
    InvalidPythFeed,
}
