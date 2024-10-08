import { Chain, ChainRegistryClient, Registry } from '@penumbra-labs/registry';
import { useQuery } from '@tanstack/react-query';
import { getChainId } from './chain-id';
import { getAssetMetadataById } from './assets';
import { AssetId } from '@penumbra-zone/protobuf/penumbra/core/asset/v1/asset_pb';

export const chainRegistryClient = new ChainRegistryClient();

export const useRegistry = () => {
  return useQuery({
    queryKey: ['penumbraRegistry'],
    queryFn: async (): Promise<Registry> => {
      const chainId = await getChainId();
      if (!chainId) {
        throw new Error('No chain id in response');
      }
      return chainRegistryClient.remote.get(chainId);
    },
    staleTime: Infinity,
  });
};

export const getStakingTokenMetadata = async () => {
  const chainId = await getChainId();
  if (!chainId) {
    throw new Error('Could not fetch chain id');
  }

  const { stakingAssetId } = chainRegistryClient.bundled.globals();
  const stakingAssetsMetadata = await getAssetMetadataById(stakingAssetId);

  if (!stakingAssetsMetadata) {
    throw new Error('Could not fetch staking asset metadata');
  }
  return stakingAssetsMetadata;
};

export const getAssetTokenMetadata = async (assetId: AssetId) => {
  const chainId = await getChainId();
  if (!chainId) {
    throw new Error('Could not fetch chain id');
  }

  const assetTokenMetadata = await getAssetMetadataById(assetId);

  if (!assetTokenMetadata) {
    throw new Error('Could not fetch asset token metadata');
  }
  return assetTokenMetadata;
};

export const getChains = async (): Promise<Chain[]> => {
  const chainId = await getChainId();
  if (!chainId) {
    throw new Error('Could not fetch chain id');
  }

  const { ibcConnections } = await chainRegistryClient.remote.get(chainId);
  return ibcConnections;
};
