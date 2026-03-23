import axios, { AxiosError } from "axios";
import cors from "cors";
import dotenv from "dotenv";
import express, { type Request, type Response } from "express";
import morgan from "morgan";
import { z } from "zod";

dotenv.config();

const app = express();

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  COINSBUY_CLIENT_ID: z.string().min(1),
  COINSBUY_CLIENT_SECRET: z.string().min(1),
  COINSBUY_BASE_URL: z
    .string()
    .url()
    .default("https://v3.api-sandbox.coinsbuy.com"),
  FRONTEND_URL: z.string().default("http://localhost:3001"),
});

const env = envSchema.parse(process.env);


app.use(cors({ origin: [env.FRONTEND_URL,"http://69.62.85.63:3001", ,"*"]}));
app.use(morgan("dev"));
app.use(express.json());

const coinsbuy = axios.create({
  baseURL: env.COINSBUY_BASE_URL,
  headers: {
    "Content-Type": "application/vnd.api+json",
  },
  timeout: 15_000,
});

type AuthCache = {
  accessToken: string;
  expiresAtMs: number;
};

let authCache: AuthCache | null = null;

const tokenSafetyWindowMs = 10_000;

const getAuthToken = async (): Promise<string> => {
  const now = Date.now();
  if (authCache && authCache.expiresAtMs - tokenSafetyWindowMs > now) {
    return authCache.accessToken;
  }

  const response = await coinsbuy.post("/token/", {
    data: {
      type: "auth-token",
      attributes: {
        client_id: env.COINSBUY_CLIENT_ID,
        client_secret: env.COINSBUY_CLIENT_SECRET,
      },
    },
  });
  console.log("Token response:", JSON.stringify(response.data, null, 2));

  
  const attributes = response.data?.data?.attributes;
const accessToken = attributes?.access ?? attributes?.access_token;
const expiresInSeconds = Number(attributes?.expires_in ?? 0);
  console.log("Access Token:", accessToken);
  console.log("Expires In Seconds:", expiresInSeconds);
  if (!accessToken || !expiresInSeconds) {
    throw new Error("CoinsBuy token response is missing required fields");
  }

  authCache = {
    accessToken,
    expiresAtMs: now + expiresInSeconds * 1000,
  };
  console.log("Cached token:", JSON.stringify(authCache, null, 2));
  return accessToken;
};

const withAuthHeaders = async () => {
  const token = await getAuthToken();
  console.log("Token:", JSON.stringify(token, null, 2));
  return {
    Authorization: `Bearer ${token}`,
  };
};

const mapAxiosError = (error: unknown) => {
  if (error instanceof AxiosError) {
    return {
      status: error.response?.status ?? 500,
      data: error.response?.data ?? { message: error.message },
    };
  }

  return {
    status: 500,
    data: { message: "Unknown server error" },
  };
};


const isValidId = (id: string): boolean => /^[\w-]+$/.test(id);

const createDepositSchema = z.object({
  walletId: z.string().min(1),
  label: z.string().max(32).optional(),
  trackingId: z.string().max(128).optional(),
  callbackUrl: z.string().url().optional(),
  confirmationsNeeded: z.number().int().min(0).max(100).optional(),
  paymentPageRedirectUrl: z.string().url().optional(),
  paymentPageButtonText: z.string().max(64).optional(),
});

app.get("/api/health", async (_req: Request, res: Response) => {
  try {
    const response = await coinsbuy.get("/ping");
    res.json({ ok: true, coinsbuy: response.data });
  } catch (error) {
    const mapped = mapAxiosError(error);
    res.status(mapped.status).json({ ok: false, error: mapped.data });
  }
});

app.get("/api/coinsbuy/wallets", async (_req: Request, res: Response) => {
  try {
    console.log("ahhahah")
    const headers = await withAuthHeaders();
    console.log("Headers:", JSON.stringify(headers, null, 2));
    const response = await coinsbuy.get("/wallet/", { headers });
    console.log("Wallets response:", JSON.stringify(response.data, null, 2));
    res.json(response.data);
  } catch (error) {
    const mapped = mapAxiosError(error);
    res.status(mapped.status).json(mapped.data);
  }
});

app.post("/api/coinsbuy/deposits", async (req: Request, res: Response) => {
  const parsed = createDepositSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      message: "Invalid request body",
      errors: parsed.error.flatten(),
    });
  }

  const {
    walletId,
    label,
    trackingId,
    callbackUrl,
    confirmationsNeeded,
    paymentPageRedirectUrl,
    paymentPageButtonText,
  } = parsed.data;

  const attributes: Record<string, string | number> = {};

  if (label) attributes.label = label;
  if (trackingId) attributes.tracking_id = trackingId;
  if (callbackUrl) attributes.callback_url = callbackUrl;
  if (confirmationsNeeded !== undefined) {
    attributes.confirmations_needed = confirmationsNeeded;
  }
  if (paymentPageRedirectUrl) {
    attributes.payment_page_redirect_url = paymentPageRedirectUrl;
  }
  if (paymentPageButtonText) {
    attributes.payment_page_button_text = paymentPageButtonText;
  }

  const body = {
    data: {
      type: "deposit",
      attributes,
      relationships: {
        wallet: {
          data: {
            type: "wallet",
            id: walletId,
          },
        },
      },
    },
  };

  try {
    const headers = await withAuthHeaders();
    const response = await coinsbuy.post("/deposit/", body, { headers });
    return res.status(201).json(response.data);
  } catch (error) {
    const mapped = mapAxiosError(error);
    return res.status(mapped.status).json(mapped.data);
  }
});

app.get("/api/coinsbuy/deposits/:id", async (req: Request, res: Response) => {
  
  if (!isValidId((req.params as any)?.id)) {
    return res.status(400).json({ message: "Invalid deposit ID" });
  }

  try {
    const headers = await withAuthHeaders();
    const response = await coinsbuy.get(`/deposit/${req.params.id}`, {
      headers,
    });
    res.json(response.data);
  } catch (error) {
    const mapped = mapAxiosError(error);
    res.status(mapped.status).json(mapped.data);
  }
});

app.post("/api/coinsbuy/callback", (req: Request, res: Response) => {
  console.log("CoinsBuy callback:", JSON.stringify(req.body, null, 2));
  res.sendStatus(200);
});

app.listen(env.PORT, "0.0.0.0", () => {
  console.log(`Backend running on http://0.0.0.0:${env.PORT}`);
});
