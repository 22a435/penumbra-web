import {
  generate_spend_key,
  get_address_by_index,
  get_ephemeral_address,
  get_full_viewing_key,
  get_wallet_id,
} from '../wasm/index.js';
import {
  Address,
  FullViewingKey,
  SpendKey,
  WalletId,
} from '@penumbra-zone/protobuf/penumbra/core/keys/v1/keys_pb';

export const generateSpendKey = (seedPhrase: string) =>
  SpendKey.fromBinary(generate_spend_key(seedPhrase));

export const getFullViewingKey = (spendKey: SpendKey) =>
  FullViewingKey.fromBinary(get_full_viewing_key(spendKey.toBinary()));

export const getAddressByIndex = (fullViewingKey: FullViewingKey, index: number) => {
  const bytes = get_address_by_index(fullViewingKey.toBinary(), index);
  return Address.fromBinary(bytes);
};

export const getEphemeralByIndex = (fullViewingKey: FullViewingKey, index: number) => {
  const bytes = get_ephemeral_address(fullViewingKey.toBinary(), index);
  return Address.fromBinary(bytes);
};

export const getWalletId = (fullViewingKey: FullViewingKey) =>
  WalletId.fromBinary(get_wallet_id(fullViewingKey.toBinary()));
