import { ValueView } from '@penumbra-zone/protobuf/penumbra/core/asset/v1/asset_pb';
import { createGetter } from './utils/create-getter.js';
import { bech32mAssetId } from '@penumbra-zone/bech32m/passet';
import { getDisplayDenomExponent, getSymbol } from './metadata.js';
import { Any } from '@bufbuild/protobuf';
import { ValidatorInfo } from '@penumbra-zone/protobuf/penumbra/core/component/stake/v1/stake_pb';
import { getIdentityKeyFromValidatorInfo } from './validator-info.js';

export const getMetadata = createGetter((valueView?: ValueView) =>
  valueView?.valueView.case === 'knownAssetId' ? valueView.valueView.value.metadata : undefined,
);

export const getExtendedMetadata = createGetter((valueView?: ValueView) =>
  valueView?.valueView.case === 'knownAssetId'
    ? valueView.valueView.value.extendedMetadata
    : undefined,
);

export const getEquivalentValues = createGetter((valueView?: ValueView) =>
  valueView?.valueView.case === 'knownAssetId'
    ? valueView.valueView.value.equivalentValues
    : undefined,
);

/**
 * Only to be used on `ValueView`s that contain delegation tokens -- and thus,
 * validator infos.
 */
export const getValidatorInfoFromValueView = getExtendedMetadata.pipe(
  createGetter((a?: Any) => {
    const validatorInfo = new ValidatorInfo();
    if (a?.unpackTo(validatorInfo)) {
      return validatorInfo;
    }
    return undefined;
  }),
);

/**
 * Only to be used on `ValueView`s that contain delegation tokens -- and thus,
 * validator infos.
 */
export const getValidatorIdentityKeyFromValueView = getValidatorInfoFromValueView.pipe(
  getIdentityKeyFromValidatorInfo,
);

export const getDisplayDenomExponentFromValueView = createGetter((valueView?: ValueView) =>
  valueView?.valueView.case === 'knownAssetId'
    ? getDisplayDenomExponent(valueView.valueView.value.metadata)
    : undefined,
);

export const getAssetIdFromValueView = createGetter((v?: ValueView) => {
  switch (v?.valueView.case) {
    case 'knownAssetId':
      return v.valueView.value.metadata?.penumbraAssetId;
    case 'unknownAssetId':
      return v.valueView.value.assetId;
    default:
      return undefined;
  }
});

export const getAmount = createGetter(
  (valueView?: ValueView) => valueView?.valueView.value?.amount,
);

export const getSymbolFromValueView = getMetadata.pipe(getSymbol);

export const getDisplayDenomFromView = createGetter((view?: ValueView) => {
  if (view?.valueView.case === 'unknownAssetId') {
    if (!view.valueView.value.assetId) {
      return undefined;
    }
    return bech32mAssetId(view.valueView.value.assetId);
  }

  if (view?.valueView.case === 'knownAssetId') {
    const displayDenom = view.valueView.value.metadata?.display;
    if (displayDenom) {
      return displayDenom;
    }

    const assetId = view.valueView.value.metadata?.penumbraAssetId;
    if (assetId) {
      return bech32mAssetId(assetId);
    }

    return 'unknown';
  }

  return 'unknown';
});

export const getCase = createGetter((valueView?: ValueView) => valueView?.valueView.case);
