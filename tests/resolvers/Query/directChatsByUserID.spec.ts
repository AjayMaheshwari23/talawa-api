import "dotenv/config";
import { Types } from "mongoose";
import { connect, disconnect } from "../../helpers/db";
import mongoose from "mongoose";
import { directChatsByUserID as directChatsByUserIDResolver } from "../../../src/resolvers/Query/directChatsByUserID";
import { DirectChat } from "../../../src/models";
import { QueryDirectChatsByUserIdArgs } from "../../../src/types/generatedGraphQLTypes";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { createTestDirectChat } from "../../helpers/directChat";
import { testUserType } from "../../helpers/userAndOrg";

let testUser: testUserType;
let MONGOOSE_INSTANCE: typeof mongoose | null;

beforeAll(async () => {
  MONGOOSE_INSTANCE = await connect();
  const resultArray = await createTestDirectChat();
  testUser = resultArray[0];
});

afterAll(async () => {
  await disconnect(MONGOOSE_INSTANCE!);
});

describe("resolvers -> Query -> directChatsByUserID", () => {
  it(`throws NotFoundError if no directChats exists with directChats.users
  containing user with _id === args.id`, async () => {
    try {
      const args: QueryDirectChatsByUserIdArgs = {
        id: Types.ObjectId().toString(),
      };

      await directChatsByUserIDResolver?.({}, args, {});
    } catch (error: any) {
      expect(error.message).toEqual("DirectChats not found");
    }
  });

  it(`returns list of all directChats with directChat.users containing the user
  with _id === args.id`, async () => {
    const args: QueryDirectChatsByUserIdArgs = {
      id: testUser?._id,
    };

    const directChatsByUserIdPayload = await directChatsByUserIDResolver?.(
      {},
      args,
      {}
    );

    const directChatsByUserId = await DirectChat.find({
      users: testUser?._id,
    }).lean();

    expect(directChatsByUserIdPayload).toEqual(directChatsByUserId);
  });
});
