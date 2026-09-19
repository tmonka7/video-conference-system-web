import { asyncHandler } from '../../utils/asyncHandler.js';
import { created, noContent, ok } from '../../utils/response.js';
import * as contactsService from './contacts.service.js';

export const list = asyncHandler(async (req, res) => {
  ok(res, await contactsService.listContacts(req.user._id.toString(), req.query));
});

export const add = asyncHandler(async (req, res) => {
  created(res, await contactsService.addContact(req.user._id.toString(), req.body.identifier));
});

export const accept = asyncHandler(async (req, res) => {
  ok(res, await contactsService.acceptContact(req.user._id.toString(), req.params.id));
});

export const favorite = asyncHandler(async (req, res) => {
  ok(
    res,
    await contactsService.setFavorite(req.user._id.toString(), req.params.id, req.body.favorite),
  );
});

export const block = asyncHandler(async (req, res) => {
  ok(res, await contactsService.blockContact(req.user._id.toString(), req.params.id));
});

export const remove = asyncHandler(async (req, res) => {
  await contactsService.removeContact(req.user._id.toString(), req.params.id);
  noContent(res);
});
