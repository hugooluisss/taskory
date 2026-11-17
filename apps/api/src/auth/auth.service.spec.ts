import * as bcrypt from "bcrypt";
import * as jwt from "jsonwebtoken";
import { AuthService } from "./auth.service";
import { User } from "../users/entities/user.entity";
import { UsersService } from "../users/users.service";
import { DuplicateEmailError } from "../users/duplicate-email.error";

const user = (overrides: Partial<User> = {}): User => ({
  id: "user-1",
  email: "person@example.com",
  name: "Person",
  passwordHash: "",
  language: "en",
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe("User registration", () => {
  let users: jest.Mocked<
    Pick<
      UsersService,
      "findById" | "findByEmailWithHash" | "register" | "update"
    >
  >;
  let auth: AuthService;

  beforeEach(() => {
    process.env.JWT_SECRET = "test-secret";
    users = {
      findById: jest.fn(),
      findByEmailWithHash: jest.fn(),
      register: jest.fn(),
      update: jest.fn(),
    };
    auth = new AuthService(users as unknown as UsersService);
  });

  it("Successful registration", async () => {
    users.register.mockImplementation(async (email, name, passwordHash) =>
      user({ email, name, passwordHash }),
    );

    const result = await auth.register(
      "person@example.com",
      "Person",
      "password-123",
    );

    const passwordHash = users.register.mock.calls[0][2];
    expect(await bcrypt.compare("password-123", passwordHash)).toBe(true);
    expect(result.token).toBeTruthy();
    expect(result.user).toEqual({
      id: "user-1",
      email: "person@example.com",
      name: "Person",
      language: "en",
    });
    expect(result.user).not.toHaveProperty("passwordHash");
  });

  it("Duplicate email", async () => {
    users.register.mockRejectedValue(new DuplicateEmailError());

    await expect(
      auth.register("person@example.com", "Person", "password-123"),
    ).rejects.toMatchObject({ response: { code: "EMAIL_TAKEN" }, status: 409 });
    expect(users.register).toHaveBeenCalled();
  });

  it("Concurrent duplicate email insert is rejected", async () => {
    users.register.mockRejectedValue(new DuplicateEmailError());

    await expect(
      auth.register("person@example.com", "Person", "password-123"),
    ).rejects.toMatchObject({ response: { code: "EMAIL_TAKEN" }, status: 409 });
  });

  it("Unexpected registration failures propagate", async () => {
    const failure = new Error("storage unavailable");
    users.register.mockRejectedValue(failure);

    await expect(
      auth.register("person@example.com", "Person", "password-123"),
    ).rejects.toBe(failure);
  });
});

describe("User login", () => {
  let users: jest.Mocked<
    Pick<
      UsersService,
      "findById" | "findByEmailWithHash" | "register" | "update"
    >
  >;
  let auth: AuthService;

  beforeEach(() => {
    process.env.JWT_SECRET = "test-secret";
    users = {
      findById: jest.fn(),
      findByEmailWithHash: jest.fn(),
      register: jest.fn(),
      update: jest.fn(),
    };
    auth = new AuthService(users as unknown as UsersService);
  });

  it("Valid credentials", async () => {
    users.findByEmailWithHash.mockResolvedValue(
      user({ passwordHash: await bcrypt.hash("password-123", 4) }),
    );

    const result = await auth.login("person@example.com", "password-123");

    expect(result.token).toBeTruthy();
    expect(result.user).toEqual({
      id: "user-1",
      email: "person@example.com",
      name: "Person",
      language: "en",
    });
  });

  it("Invalid credentials", async () => {
    users.findByEmailWithHash.mockResolvedValue(null);
    const unknown = auth.login("missing@example.com", "password-123");
    users.findByEmailWithHash.mockResolvedValue(
      user({ passwordHash: await bcrypt.hash("password-123", 4) }),
    );
    const wrongPassword = auth.login("person@example.com", "incorrect");

    await expect(unknown).rejects.toMatchObject({
      response: { code: "INVALID_CREDENTIALS" },
      status: 401,
    });
    await expect(wrongPassword).rejects.toMatchObject({
      response: { code: "INVALID_CREDENTIALS" },
      status: 401,
    });
  });
});

describe("Authenticated profile", () => {
  let users: jest.Mocked<
    Pick<
      UsersService,
      "findById" | "findByEmailWithHash" | "register" | "update"
    >
  >;
  let auth: AuthService;

  beforeEach(() => {
    process.env.JWT_SECRET = "test-secret";
    users = {
      findById: jest.fn(),
      findByEmailWithHash: jest.fn(),
      register: jest.fn(),
      update: jest.fn(),
    };
    auth = new AuthService(users as unknown as UsersService);
  });

  it("Read profile", async () => {
    users.findById.mockResolvedValue(user());
    users.update.mockResolvedValue(user({ name: "Updated", language: "es" }));

    await expect(auth.profile("user-1")).resolves.toEqual({
      id: "user-1",
      email: "person@example.com",
      name: "Person",
      language: "en",
    });
    await expect(
      auth.updateProfile("user-1", { name: "Updated", language: "es" }),
    ).resolves.toEqual({
      id: "user-1",
      email: "person@example.com",
      name: "Updated",
      language: "es",
    });
  });

  it("Missing profile is unauthorized", async () => {
    users.findById.mockResolvedValue(null);

    await expect(auth.profile("missing")).rejects.toMatchObject({
      response: { code: "UNAUTHORIZED" },
      status: 401,
    });
  });

  it("Valid JWT uses HS256", async () => {
    users.findById.mockResolvedValue(user());
    const valid = jwt.sign({}, "test-secret", {
      algorithm: "HS256",
      subject: "user-1",
    });
    const invalid = jwt.sign({}, "test-secret", {
      algorithm: "HS384",
      subject: "user-1",
    });

    await expect(auth.authenticate(valid)).resolves.toMatchObject({
      id: "user-1",
    });
    await expect(auth.authenticate(invalid)).rejects.toMatchObject({
      response: { code: "UNAUTHORIZED" },
      status: 401,
    });
  });

  it("Missing or invalid token", async () => {
    const missingSubject = jwt.sign({}, "test-secret", { algorithm: "HS256" });
    const missingUser = jwt.sign({}, "test-secret", {
      algorithm: "HS256",
      subject: "missing",
    });
    users.findById.mockResolvedValue(null);

    await expect(auth.authenticate(missingSubject)).rejects.toMatchObject({
      response: { code: "UNAUTHORIZED" },
    });
    await expect(auth.authenticate(missingUser)).rejects.toMatchObject({
      response: { code: "UNAUTHORIZED" },
    });
  });

  it("Storage failures are not converted to unauthorized", async () => {
    users.findById.mockRejectedValue(new Error("database unavailable"));
    const token = jwt.sign({}, "test-secret", {
      algorithm: "HS256",
      subject: "user-1",
    });

    await expect(auth.authenticate(token)).rejects.toThrow(
      "database unavailable",
    );
  });
});
