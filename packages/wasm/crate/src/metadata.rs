use anyhow::anyhow;
use penumbra_asset::asset::Metadata as MetadataDomainType;
use penumbra_proto::{core::asset::v1::Metadata, DomainType};
use regex::Regex;
use wasm_bindgen::prelude::wasm_bindgen;

use crate::{error::WasmResult, utils};

pub static UNBONDING_TOKEN_REGEX: &str = "^uunbonding_(?P<data>start_at_(?P<start>[0-9]+)_(?P<validator>penumbravalid1(?P<id>[a-zA-HJ-NP-Z0-9]+)))$";
pub static DELEGATION_TOKEN_REGEX: &str =
    "^udelegation_(?P<data>penumbravalid1(?P<id>[a-zA-HJ-NP-Z0-9]+))$";
pub static AUCTION_NFT_REGEX: &str =
    "^auctionnft_(?P<data>(?<seq_num>[a-z_0-9]+)_pauctid1(?P<id>[a-zA-HJ-NP-Z0-9]+))$";
pub static VOTING_RECEIPT_REGEX: &str = "^uvoted_on_(?P<data>(?P<proposal_id>[0-9]+))$";
pub static LP_NFT_REGEX: &str = "^lpnft_(?P<lp_state>[a-z_0-9]+)_plpid1(?P<id>[a-zA-HJ-NP-Z0-9]+)$";

/// Given a binary-encoded `Metadata`, returns a new binary-encoded `Metadata`
/// with the symbol customized if the token is one of several specific types
/// that don't have built-in symbols.
#[wasm_bindgen]
pub fn customize_symbol(metadata_bytes: &[u8]) -> WasmResult<Vec<u8>> {
    utils::set_panic_hook();

    let metadata_domain_type = MetadataDomainType::decode(metadata_bytes)?;
    let metadata_proto = customize_symbol_inner(metadata_domain_type.to_proto())?;

    match MetadataDomainType::try_from(metadata_proto) {
        Ok(customized_metadata_domain_type) => Ok(customized_metadata_domain_type.encode_to_vec()),
        Err(error) => Err(error.into()),
    }
}

/// Given a `Metadata`, returns a new `Metadata` with the symbol customized if
/// the token is one of several specific types that don't have built-in symbols.
pub fn customize_symbol_inner(metadata: Metadata) -> WasmResult<Metadata> {
    let unbonding_re = Regex::new(UNBONDING_TOKEN_REGEX)?;
    let delegation_re = Regex::new(DELEGATION_TOKEN_REGEX)?;
    let auction_re = Regex::new(AUCTION_NFT_REGEX)?;
    let voting_re = Regex::new(VOTING_RECEIPT_REGEX)?;
    let lp_nft_re = Regex::new(LP_NFT_REGEX)?;

    if let Some(captures) = unbonding_re.captures(&metadata.base) {
        let asset_id = collect_id(&captures)?;
        let start_match = captures
            .name("start")
            .ok_or_else(|| anyhow!("<start> not matched in unbonding token regex"))?
            .as_str();

        return Ok(Metadata {
            symbol: format!("unbondUMat{start_match}({asset_id})"),
            ..metadata
        });
    } else if let Some(captures) = delegation_re.captures(&metadata.base) {
        let asset_id = collect_id(&captures)?;

        return Ok(Metadata {
            symbol: format!("delUM({asset_id})"),
            ..metadata
        });
    } else if let Some(captures) = auction_re.captures(&metadata.base) {
        let asset_id = collect_id(&captures)?;
        let seq_num = get_seq_num(&captures)?;

        return Ok(Metadata {
            symbol: format!("auction@{seq_num}({asset_id})"),
            ..metadata
        });
    } else if let Some(captures) = voting_re.captures(&metadata.base) {
        let proposal_id = get_proposal_id(&captures)?;

        return Ok(Metadata {
            symbol: format!("VotedOn{proposal_id}"),
            ..metadata
        });
    } else if let Some(captures) = lp_nft_re.captures(&metadata.base) {
        let (state, id) = get_lp_info(&captures)?;

        return Ok(Metadata {
            symbol: format!("lpNft:{state}({id})"),
            ..metadata
        });
    }

    Ok(metadata)
}

fn collect_id(captures: &regex::Captures) -> WasmResult<String> {
    let id_match = captures
        .name("id")
        .ok_or_else(|| anyhow!("<id> not matched in token regex"))?;
    Ok(id_match.as_str().to_string())
}

fn get_seq_num(captures: &regex::Captures) -> WasmResult<String> {
    Ok(captures
        .name("seq_num")
        .ok_or_else(|| anyhow!("<seq_num> not matched in auction NFT token regex"))?
        .as_str()
        .chars()
        .collect())
}

fn get_proposal_id(captures: &regex::Captures) -> WasmResult<String> {
    let id_match = captures
        .name("proposal_id")
        .ok_or_else(|| anyhow!("<proposal_id> not matched in token regex"))?;
    Ok(id_match.as_str().to_string())
}

fn get_lp_info(captures: &regex::Captures) -> WasmResult<(String, String)> {
    let state_match = captures
        .name("lp_state")
        .ok_or_else(|| anyhow!("<lp_state> not matched in token regex"))?;
    let id_match = captures
        .name("id")
        .ok_or_else(|| anyhow!("<id> not matched in lpnft token regex"))?;
    Ok((
        state_match.as_str().to_string(),
        id_match.as_str().to_string(),
    ))
}

#[cfg(test)]
mod test_helpers {
    use penumbra_proto::core::asset::v1::DenomUnit;

    use super::*;

    pub fn get_metadata_for(display_denom: &str, base_denom_is_display_denom: bool) -> Metadata {
        let mut denom_units = Vec::new();
        denom_units.push(DenomUnit {
            aliases: Vec::new(),
            denom: if base_denom_is_display_denom {
                String::from(display_denom)
            } else {
                format!("u{display_denom}")
            },
            exponent: 0,
        });

        if !base_denom_is_display_denom {
            denom_units.push(DenomUnit {
                aliases: Vec::new(),
                denom: String::from(display_denom),
                exponent: 6,
            });
        }

        Metadata {
            base: if base_denom_is_display_denom {
                String::from(display_denom)
            } else {
                format!("u{display_denom}")
            },
            description: String::from(""),
            denom_units,
            display: String::from(display_denom),
            images: Vec::new(),
            name: String::from(""),
            penumbra_asset_id: None,
            symbol: String::from(""),
            priority_score: 0,
        }
    }

    #[test]
    fn it_interpolates_display_denom() {
        assert_eq!(get_metadata_for("penumbra", false).base, "upenumbra");
        assert_eq!(get_metadata_for("penumbra", false).display, "penumbra");
        assert_eq!(
            get_metadata_for("penumbra", false).denom_units[0].denom,
            "upenumbra"
        );
        assert_eq!(
            get_metadata_for("penumbra", false).denom_units[1].denom,
            "penumbra"
        );
    }
}

#[cfg(test)]
mod customize_symbol_inner_tests {
    use super::*;

    #[test]
    fn it_returns_non_staking_metadata_as_is() {
        let metadata = Metadata {
            name: String::from("Penumbra"),
            symbol: String::from("UM"),
            ..test_helpers::get_metadata_for("penumbra", false)
        };
        let customized_metadata = customize_symbol_inner(metadata.clone()).unwrap();

        assert_eq!(metadata, customized_metadata);
    }

    #[test]
    fn it_modifies_unbonding_token_symbol() {
        let metadata = Metadata {
            name: String::from("Unbonding Token"),
            symbol: String::from(""),
            ..test_helpers::get_metadata_for(
                "unbonding_start_at_1234_penumbravalid1abcdef123456",
                false,
            )
        };
        let customized_metadata = customize_symbol_inner(metadata.clone()).unwrap();

        assert_eq!(customized_metadata.symbol, "unbondUMat1234(abcdef123456)");
    }

    #[test]
    fn it_modifies_delegation_token_symbol() {
        let metadata = Metadata {
            name: String::from("Delegation Token"),
            symbol: String::from(""),
            ..test_helpers::get_metadata_for("delegation_penumbravalid1abcdef123456", false)
        };
        let customized_metadata = customize_symbol_inner(metadata.clone()).unwrap();

        assert_eq!(customized_metadata.symbol, "delUM(abcdef123456)");
    }

    #[test]
    fn it_modifies_auction_nft_symbol_with_seq_num() {
        let metadata = Metadata {
            name: String::from(""),
            symbol: String::from(""),
            ..test_helpers::get_metadata_for(
                "auctionnft_0_pauctid1jqyupqnzznyfpq940mv0ac33pyx77s7af3kgdw4nstjmp3567dks8n5amh",
                true,
            )
        };
        let customized_metadata = customize_symbol_inner(metadata.clone()).unwrap();

        assert_eq!(
            customized_metadata.symbol,
            "auction@0(jqyupqnzznyfpq940mv0ac33pyx77s7af3kgdw4nstjmp3567dks8n5amh)"
        );

        let metadata = Metadata {
            name: String::from(""),
            symbol: String::from(""),
            ..test_helpers::get_metadata_for(
                "auctionnft_123_pauctid1jqyupqnzznyfpq940mv0ac33pyx77s7af3kgdw4nstjmp3567dks8n5amh",
                true,
            )
        };
        let customized_metadata = customize_symbol_inner(metadata.clone()).unwrap();

        assert_eq!(
            customized_metadata.symbol,
            "auction@123(jqyupqnzznyfpq940mv0ac33pyx77s7af3kgdw4nstjmp3567dks8n5amh)"
        );
    }

    #[test]
    fn it_modifies_voting_receipt_token() {
        let metadata = Metadata {
            name: String::from(""),
            symbol: String::from(""),
            ..test_helpers::get_metadata_for("voted_on_234", false)
        };
        let customized_metadata = customize_symbol_inner(metadata.clone()).unwrap();

        assert_eq!(customized_metadata.symbol, "VotedOn234");
    }

    #[test]
    fn it_modifies_lp_nft_opened() {
        let metadata = Metadata {
            name: String::from("xyz"),
            symbol: String::from("xyz"),
            ..test_helpers::get_metadata_for(
                "lpnft_opened_plpid1pae7ssx6uwct9srws9uxznp7n087me8j9jvpmf5tve8fjupky4rqspvcd5",
                true,
            )
        };
        let customized_metadata = customize_symbol_inner(metadata.clone()).unwrap();

        assert_eq!(
            customized_metadata.symbol,
            "lpNft:opened(pae7ssx6uwct9srws9uxznp7n087me8j9jvpmf5tve8fjupky4rqspvcd5)"
        );
    }

    #[test]
    fn it_modifies_lp_nft_closed() {
        let metadata = Metadata {
            name: String::from("xyz"),
            symbol: String::from("xyz"),
            ..test_helpers::get_metadata_for(
                "lpnft_closed_plpid1y4y5y94wrtkrem0a2mv9pwqk8myv9ykfamkz28jy97ycs8zgw0ysrnqm3r",
                true,
            )
        };
        let customized_metadata = customize_symbol_inner(metadata.clone()).unwrap();

        assert_eq!(
            customized_metadata.symbol,
            "lpNft:closed(y4y5y94wrtkrem0a2mv9pwqk8myv9ykfamkz28jy97ycs8zgw0ysrnqm3r)"
        );
    }

    #[test]
    fn it_modifies_lp_nft_withdrawn() {
        let metadata = Metadata {
            name: String::from("xyz"),
            symbol: String::from("xyz"),
            ..test_helpers::get_metadata_for(
                "lpnft_withdrawn_0_plpid1pae7ssx6uwct9srws9uxznp7n087me8j9jvpmf5tve8fjupky4rqspvcd5",
                true,
            )
        };
        let customized_metadata = customize_symbol_inner(metadata.clone()).unwrap();

        assert_eq!(
            customized_metadata.symbol,
            "lpNft:withdrawn_0(pae7ssx6uwct9srws9uxznp7n087me8j9jvpmf5tve8fjupky4rqspvcd5)"
        );
    }
}

#[cfg(test)]
mod customize_symbol_tests {
    use super::*;

    #[test]
    /// `customize_symbol` is just a thin wrapper around
    /// `customize_symbol_inner` that allows metadata to be passed in as a byte
    /// array. So we'll just do a basic test to make sure it works as expected,
    /// rather than exercising every use case.
    fn it_works() {
        let metadata = Metadata {
            name: String::from("Delegation Token"),
            symbol: String::from(""),
            ..test_helpers::get_metadata_for("delegation_penumbravalid1abcdef123456", false)
        };
        let metadata_as_bytes = MetadataDomainType::try_from(metadata)
            .unwrap()
            .encode_to_vec();
        let customized_metadata_bytes = customize_symbol(&metadata_as_bytes).unwrap();
        let customized_metadata_result =
            MetadataDomainType::decode::<&[u8]>(&customized_metadata_bytes);
        let customized_metadata_proto = customized_metadata_result.unwrap().to_proto();

        assert_eq!(customized_metadata_proto.symbol, "delUM(abcdef123456)");
    }
}
