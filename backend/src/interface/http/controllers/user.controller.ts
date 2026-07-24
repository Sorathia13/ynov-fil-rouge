import { UserService } from '../../../application/user.service';
import { asyncHandler } from '../async-handler';
import { idParam } from '../validators/common.validators';
import { adminUpdateUserSchema, listUsersQuery } from '../validators/user.validators';

export function userController(users: UserService) {
  return {
    me: asyncHandler(async (req, res) => {
      res.json(await users.getById(req.actor!.id));
    }),

    updateMe: asyncHandler(async (req, res) => {
      res.json(await users.updateProfile(req.actor!.id, req.body));
    }),

    changePassword: asyncHandler(async (req, res) => {
      const { currentPassword, newPassword } = req.body as {
        currentPassword: string;
        newPassword: string;
      };
      await users.changePassword(req.actor!.id, currentPassword, newPassword);
      res.status(204).end();
    }),

    // --- Admin ---
    list: asyncHandler(async (req, res) => {
      const query = listUsersQuery.parse(req.query);
      res.json(await users.list(query));
    }),

    adminUpdate: asyncHandler(async (req, res) => {
      const { id } = idParam.parse(req.params);
      const input = adminUpdateUserSchema.parse(req.body);
      res.json(await users.adminUpdate(id, input));
    }),
  };
}
