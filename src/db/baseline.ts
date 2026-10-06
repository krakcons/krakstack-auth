// Independently captured from a clean replay, never from the database being adopted.
// Investigate PostgreSQL definition-rendering differences; do not bypass drift.
export const baselineFingerprints = new Map(
  Object.entries({
    account: "babc6511d1d7ea8fb452165dabf0d21100cbbd642c263bba8ce6e9c4e2f8e1d8",
    apikey: "f22635f5254f3d24ceb17938381ae51e42c2c9257f7a198d31b334dd85331ee3",
    domains: "85b8b5b97ed6d7386841086eae0751072d94245ad33a2fa848a773318233e5af",
    invitation:
      "2f40beedbb7a5a45bda78c6fc72408f2b6a4ee54636d99ab69411f4e31a2e193",
    jwks: "4ca1ed760908cce6912495cb64e4ee16c38220dae7d96b488572753ea010e5ad",
    member: "fd44b84012a1e7bd02b0a79cf8aec5e72d15657e27c485c5ec838a1431bd0c67",
    oauth_access_token:
      "20b7b9231bcf1fb02e36265c9d26b97b1eeb8b6c77b130a7054d95ba2bbe7e50",
    oauth_client:
      "2bd7bf3f38c6d8d2fbfd7f39ce686c381900555357a26f9716cc69fd3bc790f8",
    oauth_client_assertion:
      "ac855df0fe550e5aaa939ec90b23ed4d0aa5da0ac4d6f43500aa616362887f81",
    oauth_client_resource:
      "e1197539fd8e7ea9aa1dcba3bceb13cd846ad448748c684a18b470accec38f05",
    oauth_consent:
      "955af96a62ab91837d9aa33b511d919f06c65e09933afc17ed62d165488f26cb",
    oauth_refresh_token:
      "7ddf578232081ecce6115d946efac98aec61796711193fbac1981e3302de8970",
    oauth_resource:
      "e42ede5d10638366a8f4fcd434b0cda91d5cddad456b16714e77ebdede5ea797",
    organization:
      "590d4197236ffdac1b5b15fc70d626ab0b3fcd02720bee435e394c3976dc6144",
    project: "a1eccc7a42bfec8ddd6f65db5dcd5678d1edc07d126a917feda2562a94068f2f",
    project_organization:
      "456e453d848cb08d480c6feb6aade5eef9fc4cbdb704516fd3678226fb3a8949",
    project_user:
      "be816ba68ef1a31c90f264cdf89c0b70e1f331c1927e5adc4fc7a4460fcc9e0c",
    session: "0ab6f1395dfcf51dc0036ac130e47fd3b0f53d784d672d8a45d3a73a84dfdb32",
    two_factor:
      "d4f8cf6fcc49f394b6d02b13b200f170777e5d5b77dd478f28193b3c8d1398b9",
    user: "7186f720af53641fbfecfb23ed6e3d438564bd4ebdabde860017c159b8bca3d0",
    verification:
      "6a58dc9ad5f1e8124add451e9f015d7edb3b670b271a94562538545d01b4a945",
  }),
);
