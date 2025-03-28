import "dotenv/config";
import { Types } from "mongoose";
import { User } from "../../../src/models";
import { MutationCreateOrganizationArgs } from "../../../src/types/generatedGraphQLTypes";
import { connect, disconnect } from "../../helpers/db";
import mongoose from "mongoose";
import { createOrganization as createOrganizationResolver } from "../../../src/resolvers/Mutation/createOrganization";
import {
  LENGTH_VALIDATION_ERROR,
  REGEX_VALIDATION_ERROR,
  USER_NOT_AUTHORIZED_SUPERADMIN,
  USER_NOT_FOUND_MESSAGE,
} from "../../../src/constants";
import * as uploadImage from "../../../src/utilities/uploadImage";
import {
  beforeAll,
  afterAll,
  describe,
  it,
  expect,
  vi,
  afterEach,
} from "vitest";
import { createTestUserFunc, testUserType } from "../../helpers/user";
import * as uploadEncodedImage from "../../../src/utilities/encodedImageStorage/uploadEncodedImage";

let testUser: testUserType;
let MONGOOSE_INSTANCE: typeof mongoose | null;

vi.mock("../../utilities/uploadEncodedImage", () => ({
  uploadEncodedImage: vi.fn(),
}));

beforeAll(async () => {
  MONGOOSE_INSTANCE = await connect();
  testUser = await createTestUserFunc();
});

afterAll(async () => {
  await disconnect(MONGOOSE_INSTANCE!);
});

describe("resolvers -> Mutation -> createOrganization", () => {
  afterEach(async () => {
    vi.doUnmock("../../../src/constants");
    vi.resetModules();
  });
  it(`throws NotFoundError if no user exists with _id === context.userId`, async () => {
    const { requestContext } = await import("../../../src/libraries");
    const spy = vi
      .spyOn(requestContext, "translate")
      .mockImplementation((message) => message);
    try {
      const args: MutationCreateOrganizationArgs = {
        data: {
          description: "description",
          isPublic: true,
          name: "name",
          visibleInSearch: true,
          apiUrl: "apiUrl",
          location: "location",
        },
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
      const { createOrganization } = await import(
        "../../../src/resolvers/Mutation/createOrganization"
      );
      await createOrganization?.({}, args, context);
    } catch (error: any) {
      expect(spy).toBeCalledWith(USER_NOT_FOUND_MESSAGE);
      expect(error.message).toEqual(USER_NOT_FOUND_MESSAGE);
    }
  });

  it(`throws Not Authorised Error if user is not a super admin`, async () => {
    const { requestContext } = await import("../../../src/libraries");
    const spy = vi
      .spyOn(requestContext, "translate")
      .mockImplementation((message) => message);
    try {
      const args: MutationCreateOrganizationArgs = {
        data: {
          description: "description",
          isPublic: true,
          name: "name",
          visibleInSearch: true,
          apiUrl: "apiUrl",
          location: "location",
        },
      };

      const context = {
        userId: testUser?.id,
      };

      const { createOrganization } = await import(
        "../../../src/resolvers/Mutation/createOrganization"
      );
      await createOrganization?.({}, args, context);
    } catch (error: any) {
      expect(spy).toHaveBeenLastCalledWith(
        USER_NOT_AUTHORIZED_SUPERADMIN.message
      );
      expect(error.message).toEqual(USER_NOT_AUTHORIZED_SUPERADMIN.message);
    }
  });

  it(`creates the organization with image and returns it`, async () => {
    // vi.spyOn(uploadImage, "uploadImage").mockImplementation(
    //   async (newImagePath: any, imageAlreadyInDbPath: any) => ({
    //     newImagePath,
    //     imageAlreadyInDbPath,
    //   })
    // );

    vi.spyOn(uploadEncodedImage, "uploadEncodedImage").mockImplementation(
      async (encodedImageURL: string) => encodedImageURL
    );

    await User.findOneAndUpdate(
      {
        _id: testUser?._id,
      },
      {
        $set: {
          adminApproved: true,
          userType: "SUPERADMIN",
        },
      }
    );

    const args: MutationCreateOrganizationArgs = {
      data: {
        description: "description",
        isPublic: true,
        name: "name",
        visibleInSearch: true,
        apiUrl: "apiUrl",
        location: "location",
      },
      file: "imagePath",
    };
    const context = {
      userId: testUser!._id,
    };

    const createOrganizationPayload = await createOrganizationResolver?.(
      {},
      args,
      context
    );
    expect(createOrganizationPayload).toEqual(
      expect.objectContaining({
        description: "description",
        isPublic: true,
        name: "name",
        visibleInSearch: true,
        apiUrl: "apiUrl",
        location: "location",
        creator: testUser!._id,
        admins: [testUser!._id],
        members: [testUser!._id],
        image: "imagePath",
      })
    );
    expect(createOrganizationPayload?.image).toEqual("imagePath");

    const updatedTestUser = await User.findOne({
      _id: testUser!._id,
    })
      .select(["joinedOrganizations", "createdOrganizations", "adminFor"])
      .lean();

    expect(updatedTestUser).toEqual(
      expect.objectContaining({
        joinedOrganizations: [createOrganizationPayload!._id],
        createdOrganizations: [createOrganizationPayload!._id],
        adminFor: [createOrganizationPayload!._id],
      })
    );
  });
  it(`creates the organization without image and returns it`, async () => {
    vi.spyOn(uploadImage, "uploadImage").mockImplementation(
      async (newImagePath: any, imageAlreadyInDbPath: any) => ({
        newImagePath,
        imageAlreadyInDbPath,
      })
    );
    const args: MutationCreateOrganizationArgs = {
      data: {
        description: "description",
        isPublic: true,
        name: "name",
        visibleInSearch: true,
        apiUrl: "apiUrl",
        location: "location",
      },
      file: null,
    };
    const context = {
      userId: testUser!._id,
    };

    const createOrganizationPayload = await createOrganizationResolver?.(
      {},
      args,
      context
    );
    expect(createOrganizationPayload).toEqual(
      expect.objectContaining({
        description: "description",
        isPublic: true,
        name: "name",
        visibleInSearch: true,
        apiUrl: "apiUrl",
        location: "location",
        creator: testUser!._id,
        admins: [testUser!._id],
        members: [testUser!._id],
      })
    );
    expect(createOrganizationPayload?.image).toBe(null);
  });
  it(`throws Regex Validation Failed error if name contains a character other then number, letter, or symbol`, async () => {
    const { requestContext } = await import("../../../src/libraries");
    vi.spyOn(requestContext, "translate").mockImplementation(
      (message) => message
    );
    try {
      const args: MutationCreateOrganizationArgs = {
        data: {
          description: "description",
          isPublic: true,
          name: "🥗",
          visibleInSearch: true,
          apiUrl: "apiUrl",
          location: "location",
        },
        file: null,
      };
      const context = {
        userId: testUser!._id,
      };

      await createOrganizationResolver?.({}, args, context);
    } catch (error: any) {
      expect(error.message).toEqual(
        `${REGEX_VALIDATION_ERROR.message} in name`
      );
    }
  });
  it(`throws Regex Validation Failed error if description contains a character other then number, letter, or symbol`, async () => {
    const { requestContext } = await import("../../../src/libraries");
    vi.spyOn(requestContext, "translate").mockImplementation(
      (message) => message
    );
    try {
      const args: MutationCreateOrganizationArgs = {
        data: {
          description: "🥗",
          isPublic: true,
          name: "random",
          visibleInSearch: true,
          apiUrl: "apiUrl",
          location: "location",
        },
        file: null,
      };
      const context = {
        userId: testUser!._id,
      };

      await createOrganizationResolver?.({}, args, context);
    } catch (error: any) {
      expect(error.message).toEqual(
        `${REGEX_VALIDATION_ERROR.message} in description`
      );
    }
  });
  it(`throws Regex Validation Failed error if location contains a character other then number, letter, or symbol`, async () => {
    const { requestContext } = await import("../../../src/libraries");
    vi.spyOn(requestContext, "translate").mockImplementation(
      (message) => message
    );
    try {
      const args: MutationCreateOrganizationArgs = {
        data: {
          description: "description",
          isPublic: true,
          name: "random",
          visibleInSearch: true,
          apiUrl: "apiUrl",
          location: "🥗",
        },
        file: null,
      };
      const context = {
        userId: testUser!._id,
      };

      await createOrganizationResolver?.({}, args, context);
    } catch (error: any) {
      expect(error.message).toEqual(
        `${REGEX_VALIDATION_ERROR.message} in location`
      );
    }
  });

  it(`throws String Length Validation error if name is greater than 256 characters`, async () => {
    const { requestContext } = await import("../../../src/libraries");
    vi.spyOn(requestContext, "translate").mockImplementation(
      (message) => message
    );
    try {
      const args: MutationCreateOrganizationArgs = {
        data: {
          description: "description",
          isPublic: true,
          name: "JWQPfpdkGGGKyryb86K4YN85nDj4m4F7gEAMBbMXLax73pn2okV6kpWY0EYO0XSlUc0fAlp45UCgg3s6mqsRYF9FOlzNIDFLZ1rd03Z17cdJRuvBcAmbC0imyqGdXHGDUQmVyOjDkaOLAvjhB5uDeuEqajcAPTcKpZ6LMpigXuqRAd0xGdPNXyITC03FEeKZAjjJL35cSIUeMv5eWmiFlmmm70FU1Bp6575zzBtEdyWPLflcA2GpGmmf4zvT7nfgN3NIkwQIhk9OwP8dn75YYczcYuUzLpxBu1Lyog77YlAj5DNdTIveXu9zHeC6V4EEUcPQtf1622mhdU3jZNMIAyxcAG4ErtztYYRqFs0ApUxXiQI38rmiaLcicYQgcOxpmFvqRGiSduiCprCYm90CHWbQFq4w2uhr8HhR3r9HYMIYtrRyO6C3rPXaQ7otpjuNgE0AKI57AZ4nGG1lvNwptFCY60JEndSLX9Za6XP1zkVRLaMZArQNl",
          visibleInSearch: true,
          apiUrl: "apiUrl",
          location: "location",
        },
        file: null,
      };
      const context = {
        userId: testUser!._id,
      };

      await createOrganizationResolver?.({}, args, context);
    } catch (error: any) {
      expect(error.message).toEqual(
        `${LENGTH_VALIDATION_ERROR.message} 256 characters in name`
      );
    }
  });
  it(`throws String Length Validation error if description is greater than 500 characters`, async () => {
    const { requestContext } = await import("../../../src/libraries");
    vi.spyOn(requestContext, "translate").mockImplementation(
      (message) => message
    );
    try {
      const args: MutationCreateOrganizationArgs = {
        data: {
          description:
            "JWQPfpdkGGGKyryb86K4YN85nDj4m4F7gEAMBbMXLax73pn2okV6kpWY0EYO0XSlUc0fAlp45UCgg3s6mqsRYF9FOlzNIDFLZ1rd03Z17cdJRuvBcAmbC0imyqGdXHGDUQmVyOjDkaOLAvjhB5uDeuEqajcAPTcKpZ6LMpigXuqRAd0xGdPNXyITC03FEeKZAjjJL35cSIUeMv5eWmiFlmmm70FU1Bp6575zzBtEdyWPLflcA2GpGmmf4zvT7nfgN3NIkwQIhk9OwP8dn75YYczcYuUzLpxBu1Lyog77YlAj5DNdTIveXu9zHeC6V4EEUcPQtf1622mhdU3jZNMIAyxcAG4ErtztYYRqFs0ApUxXiQI38rmiaLcicYQgcOxpmFvqRGiSduiCprCYm90CHWbQFq4w2uhr8HhR3r9HYMIYtrRyO6C3rPXaQ7otpjuNgE0AKI57AZ4nGG1lvNwptFCY60JEndSLX9Za6XP1zkVRLaMZArQNl",
          isPublic: true,
          name: "random",
          visibleInSearch: true,
          apiUrl: "apiUrl",
          location: "location",
        },
        file: null,
      };
      const context = {
        userId: testUser!._id,
      };

      await createOrganizationResolver?.({}, args, context);
    } catch (error: any) {
      expect(error.message).toEqual(
        `${LENGTH_VALIDATION_ERROR.message} 500 characters in description`
      );
    }
  });
  it(`throws String Length Validation error if location is greater than 50 characters`, async () => {
    const { requestContext } = await import("../../../src/libraries");
    vi.spyOn(requestContext, "translate").mockImplementation(
      (message) => message
    );
    try {
      const args: MutationCreateOrganizationArgs = {
        data: {
          description: "description",
          isPublic: true,
          name: "random",
          visibleInSearch: true,
          apiUrl: "apiUrl",
          location:
            "JWQPfpdkGGGKyryb86K4YN85nDj4m4F7gEAMBbMXLax73pn2okV6kpWY0EYO0XSlUc0fAlp45UCgg3s6mqsRYF9FOlzNIDFLZ1rd03Z17cdJRuvBcAmbC0imyqGdXHGDUQmVyOjDkaOLAvjhB5uDeuEqajcAPTcKpZ6LMpigXuqRAd0xGdPNXyITC03FEeKZAjjJL35cSIUeMv5eWmiFlmmm70FU1Bp6575zzBtEdyWPLflcA2GpGmmf4zvT7nfgN3NIkwQIhk9OwP8dn75YYczcYuUzLpxBu1Lyog77YlAj5DNdTIveXu9zHeC6V4EEUcPQtf1622mhdU3jZNMIAyxcAG4ErtztYYRqFs0ApUxXiQI38rmiaLcicYQgcOxpmFvqRGiSduiCprCYm90CHWbQFq4w2uhr8HhR3r9HYMIYtrRyO6C3rPXaQ7otpjuNgE0AKI57AZ4nGG1lvNwptFCY60JEndSLX9Za6XP1zkVRLaMZArQNl",
        },
        file: null,
      };
      const context = {
        userId: testUser!._id,
      };

      await createOrganizationResolver?.({}, args, context);
    } catch (error: any) {
      expect(error.message).toEqual(
        `${LENGTH_VALIDATION_ERROR.message} 50 characters in location`
      );
    }
  });
});
