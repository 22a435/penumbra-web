import { ServiceWorkerResponse } from './internal/types';
import { internalRouter, isInternalRequest, SwRequestMessage } from './internal/router';
import { isViewServerReq, viewServerRouter } from './grpc/view-protocol-server/router';
import { ServicesInterface } from 'penumbra-types';

// Used to filter for service worker messages and narrow their type to pass to the typed handler.
// Exposed to service worker for listening for internal and external messages
export const penumbraMessageHandler =
  (services: ServicesInterface) =>
  (
    message: unknown,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: ServiceWorkerResponse<SwRequestMessage>) => void,
  ) => {
    if (!allowedRequest(sender)) return;

    if (isInternalRequest(message)) {
      return internalRouter(message, sendResponse, services);
    } else if (isViewServerReq(message)) {
      viewServerRouter(message, sender, services);
    }
    return;
  };

// Protections to guard for allowed messages only. Requirements:
// - TODO: If message from dapp, should only be from sites that have received permission via `connect`
// - If message from extension, ensure it comes from our own and not an external extension
const allowedRequest = (sender: chrome.runtime.MessageSender): boolean => {
  return sender.tab?.id !== undefined || sender.id === chrome.runtime.id;
};
