import { beforeEach, describe, expect, test } from 'vitest';
import { create, StoreApi, UseBoundStore } from 'zustand';
import { AllSlices, initializeStore } from '.';
import { Metadata, ValueView } from '@penumbra-zone/protobuf/penumbra/core/asset/v1/asset_pb';
import { Amount } from '@penumbra-zone/protobuf/penumbra/core/num/v1/num_pb';
import { sendValidationErrors } from './send';
import { AddressView } from '@penumbra-zone/protobuf/penumbra/core/keys/v1/keys_pb';
import { produce } from 'immer';
import { BalancesResponse } from '@penumbra-zone/protobuf/penumbra/view/v1/view_pb';
import { addressFromBech32m } from '@penumbra-zone/bech32m/penumbra';
import { Chain } from '@penumbra-labs/registry';
import { currentTimePlusTwoDaysRounded, ibcValidationErrors } from './ibc-out';

describe('IBC Slice', () => {
  const selectionExample = new BalancesResponse({
    balanceView: new ValueView({
      valueView: {
        case: 'knownAssetId',
        value: {
          amount: new Amount({
            lo: 0n,
            hi: 0n,
          }),
          metadata: new Metadata({ display: 'test_usd', denomUnits: [{ exponent: 18 }] }),
        },
      },
    }),
    accountAddress: new AddressView({
      addressView: {
        case: 'opaque',
        value: {
          address: addressFromBech32m(
            'penumbra1e8k5cyds484dxvapeamwveh5khqv4jsvyvaf5wwxaaccgfghm229qw03pcar3ryy8smptevstycch0qk3uu0rgkvtjpxy3cu3rjd0agawqtlz6erev28a6sg69u7cxy0t02nd4',
          ),
        },
      },
    }),
  });

  let useStore: UseBoundStore<StoreApi<AllSlices>>;

  beforeEach(() => {
    useStore = create<AllSlices>()(initializeStore()) as UseBoundStore<StoreApi<AllSlices>>;
  });

  test('the default is empty, false or undefined', () => {
    expect(useStore.getState().ibcOut.amount).toBe('');
    expect(useStore.getState().ibcOut.selection).toBeUndefined();
    expect(useStore.getState().ibcOut.chain).toBeUndefined();
  });

  describe('setAmount', () => {
    test('amount can be set', () => {
      useStore.getState().ibcOut.setAmount('2');
      expect(useStore.getState().ibcOut.amount).toBe('2');
    });

    // TODO [vanishmax, 2024-06-04]: Remove test skipping
    test.skip('validate high enough amount validates', () => {
      const assetBalance = new Amount({ hi: 1n });
      const state = produce(selectionExample, draft => {
        draft.balanceView!.valueView.value!.amount = assetBalance;
      });
      useStore.getState().send.setSelection(state);
      useStore.getState().send.setAmount('1');
      const { selection, amount } = useStore.getState().send;

      const { amountErr } = sendValidationErrors(selection, amount, 'xyz');
      expect(amountErr).toBeFalsy();
    });

    test.skip('validate error when too low the balance of the asset', () => {
      const assetBalance = new Amount({ lo: 2n });
      const state = produce(selectionExample, draft => {
        draft.balanceView!.valueView.value!.amount = assetBalance;
      });
      useStore.getState().send.setSelection(state);
      useStore.getState().send.setAmount('6');
      const { selection, amount } = useStore.getState().send;
      const { amountErr } = sendValidationErrors(selection, amount, 'xyz');
      expect(amountErr).toBeTruthy();
    });
  });

  describe('setChain', () => {
    const chain = {
      displayName: 'Osmosis',
      chainId: 'osmosis-test-5',
      channelId: 'channel-0',
      counterpartyChannelId: 'channel-999',
      images: [{ svg: '/test.svg' }],
      addressPrefix: 'osmo',
    } satisfies Chain;

    test('chain can be set', () => {
      useStore.getState().ibcOut.setChain(chain);
      expect(useStore.getState().ibcOut.chain).toBe(chain);
    });

    test('destination address validation per selected chain', () => {
      const osmoAddress = 'osmo1dyrr4r42ql4em7d46srcmnn5ymxk9asvcv95sg';

      useStore.getState().ibcOut.setChain(chain);
      useStore.getState().ibcOut.setDestinationChainAddress(osmoAddress);

      const validationErrors = ibcValidationErrors(useStore.getState());

      expect(validationErrors.recipientErr).toBeFalsy();
    });

    test('destination address validation per selected chain fails with incorrect address', () => {
      const osmoAddress = 'osmo1xxxxxx';

      useStore.getState().ibcOut.setChain(chain);
      useStore.getState().ibcOut.setDestinationChainAddress(osmoAddress);

      const validationErrors = ibcValidationErrors(useStore.getState());

      expect(validationErrors.recipientErr).toBeTruthy();
    });
  });

  describe('setSelection', () => {
    test('asset and account can be set', () => {
      useStore.getState().send.setSelection(selectionExample);
      expect(useStore.getState().send.selection).toStrictEqual(selectionExample);
    });
  });
});

describe('currentTimePlusTwoDaysRounded', () => {
  test('should add exactly two days to the current time and round up to the nearest ten minutes', () => {
    const currentTimeMs = 1713519156000; // Apr 19 2024 9:32:36
    const twoDaysRoundedNano = 1713692400000000000n; // Apr 21 2024 9:40:00

    const result = currentTimePlusTwoDaysRounded(currentTimeMs);
    expect(result).toEqual(twoDaysRoundedNano);
  });
});
