import {
  Configuration,
  CountryCode,
  PlaidApi,
  PlaidEnvironments,
  Products,
} from "plaid";

function getPlaidEnvironment() {
  const env = process.env.PLAID_ENV || "sandbox";

  if (env === "production") return PlaidEnvironments.production;
  if (env === "development") return PlaidEnvironments.development;

  return PlaidEnvironments.sandbox;
}

export function getPlaidClient() {
  const clientId = process.env.PLAID_CLIENT_ID;
  const secret = process.env.PLAID_SECRET;

  if (!clientId) {
    throw new Error("Missing PLAID_CLIENT_ID.");
  }

  if (!secret) {
    throw new Error("Missing PLAID_SECRET.");
  }

  const configuration = new Configuration({
    basePath: getPlaidEnvironment(),
    baseOptions: {
      headers: {
        "PLAID-CLIENT-ID": clientId,
        "PLAID-SECRET": secret,
      },
    },
  });

  return new PlaidApi(configuration);
}

export function getPlaidProducts() {
  const products = (process.env.PLAID_PRODUCTS || "transactions")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  return products.map((product) => {
    if (product === "auth") return Products.Auth;
    if (product === "identity") return Products.Identity;
    if (product === "assets") return Products.Assets;
    if (product === "liabilities") return Products.Liabilities;
    if (product === "investments") return Products.Investments;

    return Products.Transactions;
  });
}

export function getPlaidCountryCodes() {
  const countryCodes = (process.env.PLAID_COUNTRY_CODES || "US")
    .split(",")
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean);

  return countryCodes.map((code) => {
    if (code === "CA") return CountryCode.Ca;
    if (code === "GB") return CountryCode.Gb;
    if (code === "ES") return CountryCode.Es;
    if (code === "FR") return CountryCode.Fr;
    if (code === "IE") return CountryCode.Ie;
    if (code === "NL") return CountryCode.Nl;

    return CountryCode.Us;
  });
}