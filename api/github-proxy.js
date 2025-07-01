export default async function handler(req, res) {
  const GITHUB_USERNAME = 'Revive1Subs';
  const REPO_NAME = 'revivesubs-data';
  const FILE_PATH = 'data.json';
  const GITHUB_PAT = process.env.GITHUB_PAT;
  const GITHUB_API_URL = `https://api.github.com/repos/${GITHUB_USERNAME}/${REPO_NAME}/contents/${FILE_PATH}`;

  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method === 'GET') {
    try {
      const response = await fetch(GITHUB_API_URL, {
        headers: {
          'Authorization': `token ${GITHUB_PAT}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      });
      const data = await response.json();
      res.status(200).json(data);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  } 
  else if (req.method === 'POST') {
    try {
      const { content, sha } = req.body;
      const response = await fetch(GITHUB_API_URL, {
        method: 'PUT',
        headers: {
          'Authorization': `token ${GITHUB_PAT}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: `Data update: ${new Date().toISOString()}`,
          content: content,
          sha: sha,
        }),
      });
      const data = await response.json();
      res.status(200).json(data);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  } 
  else {
    res.setHeader('Allow', ['GET', 'POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
