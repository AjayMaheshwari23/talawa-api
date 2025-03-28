import "dotenv/config";
import { Types } from "mongoose";
import { connect, disconnect } from "../../helpers/db";
import mongoose from "mongoose";
import { MutationAddUserImageArgs } from "../../../src/types/generatedGraphQLTypes";
import { USER_NOT_FOUND_MESSAGE } from "../../../src/constants";
import {
  beforeAll,
  afterAll,
  describe,
  it,
  expect,
  afterEach,
  vi,
} from "vitest";
import { testUserType, createTestUser } from "../../helpers/userAndOrg";
import * as uploadEncodedImage from "../../../src/utilities/encodedImageStorage/uploadEncodedImage";
import { addUserImage as addUserImageResolverUserImage } from "../../../src/resolvers/Mutation/addUserImage";

let testUser: testUserType;
let MONGOOSE_INSTANCE: typeof mongoose | null;

vi.mock("../../utilities/uploadEncodedImage", () => ({
  uploadEncodedImage: vi.fn(),
}));

beforeAll(async () => {
  MONGOOSE_INSTANCE = await connect();
  testUser = await createTestUser();
});

afterAll(async () => {
  await disconnect(MONGOOSE_INSTANCE!);
});

describe("resolvers -> Mutation -> addUserImage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.doUnmock("../../../src/constants");
    vi.resetModules();
  });
  it(`throws NotFoundError if no user exists with _id === context.userId // IN_PRODUCTION=true`, async () => {
    const { requestContext } = await import("../../../src/libraries");

    const spy = vi
      .spyOn(requestContext, "translate")
      .mockImplementationOnce((message) => `Translated ${message}`);

    try {
      const args: MutationAddUserImageArgs = {
        file: "",
      };

      const context = {
        userId: Types.ObjectId().toString(),
      };

      vi.doMock("../../../src/constants", async () => {
        const actualConstants: object = await vi.importActual(
          "../../../src/constants"
        );
        return {
          ...actualConstants,
        };
      });
      const { addUserImage: addUserImageResolverUserError } = await import(
        "../../../src/resolvers/Mutation/addUserImage"
      );
      await addUserImageResolverUserError?.({}, args, context);
    } catch (error: any) {
      expect(spy).toHaveBeenLastCalledWith(USER_NOT_FOUND_MESSAGE);
      expect(error.message).toEqual(`Translated ${USER_NOT_FOUND_MESSAGE}`);
    }
  });

  it(`When Image is given, updates current user's user object and returns the object when Image is not in DB path`, async () => {
    const args: MutationAddUserImageArgs = {
      file: "newImageFile.png",
    };
    vi.spyOn(uploadEncodedImage, "uploadEncodedImage").mockImplementation(
      async (encodedImageURL: string) => encodedImageURL
    );
    const context = {
      userId: testUser!._id,
    };

    const addUserImagePayload = await addUserImageResolverUserImage?.(
      {},
      args,
      context
    );

    expect(addUserImagePayload).toEqual({
      ...testUser!.toObject(),

      image: "newImageFile.png",
    });
  });
});
