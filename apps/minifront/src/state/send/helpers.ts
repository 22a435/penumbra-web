import { Metadata } from '@penumbra-zone/protobuf/penumbra/core/asset/v1/asset_pb';
import { BalancesResponse } from '@penumbra-zone/protobuf/penumbra/view/v1/view_pb';
import { getDisplay } from '@penumbra-zone/getters/metadata';
import { getMetadata } from '@penumbra-zone/getters/value-view';
import { assetPatterns } from '@penumbra-zone/types/assets';
import { isKnown } from '../helpers';
import { AbridgedZQueryState } from '@penumbra-zone/zquery/src/types';

const nonTransferableAssetPatterns = [
  assetPatterns.proposalNft,
  assetPatterns.auctionNft,
  assetPatterns.lpNft,
];

const isTransferable = (metadata: Metadata) =>
  nonTransferableAssetPatterns.every(pattern => !pattern.matches(getDisplay(metadata)));

export const transferableBalancesResponsesSelector = (
  zQueryState: AbridgedZQueryState<BalancesResponse[]>,
) => ({
  loading: zQueryState.loading,
  error: zQueryState.error,
  data: zQueryState.data?.filter(
    balance => isKnown(balance) && isTransferable(getMetadata(balance.balanceView)),
  ),
});
