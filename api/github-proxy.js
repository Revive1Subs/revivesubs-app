export default async function handler(req, res) {
  const GITHUB_PAT = process.env.GITHUB_PAT;
  res.status(200).json({
    message: "Test response",
    patExists: !!GITHUB_PAT,
    patStart: GITHUB_PAT ? GITHUB_PAT.substring(0, 6) : null
  });
}
