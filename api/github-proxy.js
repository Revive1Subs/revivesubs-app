// api/github-proxy.js

async function apiRequest(url, method = 'GET', body = null, pat) {
  const headers = {
    'Authorization': `token ${pat}`,
    'Accept': 'application/vnd.github.v3+json',
  };
  if (body) headers['Content-Type'] = 'application/json';

  const response = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : null });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(`GitHub API Error: ${response.status} ${errorData.message || ''}`);
  }
  return response.json();
}

export default async function handler(req, res) {
  const GITHUB_PAT      = process.env.GITHUB_PAT;
  const GITHUB_USERNAME = 'Revive1Subs';
  const REPO_NAME       = 'revivesubs-data';
  const FILE_PATH       = 'data.json';
  const API_BASE        = 'https://api.github.com';
  const GIT_BRANCH      = 'main';

  if (!GITHUB_PAT) {
    return res.status(500).json({ error: 'GITHUB_PAT غير معرف في البيئة.' });
  }

  // إعدادات CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // ======== GET ========
  if (req.method === 'GET') {
    try {
      // أولاً نطلب بيانات الملف من GitHub
      const url = `${API_BASE}/repos/${GITHUB_USERNAME}/${REPO_NAME}/contents/${FILE_PATH}?ref=${GIT_BRANCH}`;
      const fileMeta = await apiRequest(url, 'GET', null, GITHUB_PAT);

      // إذا لم يُرجع GitHub حقل content، نجرب التحميل عبر download_url
      let content = fileMeta.content;
      if (!content && fileMeta.download_url) {
        const rawRes = await fetch(fileMeta.download_url);
        const text = await rawRes.text();
        content = btoa(unescape(encodeURIComponent(text)));
      }

      // الآن نُعيد المحتوى و SHA
      return res.status(200).json({ content, sha: fileMeta.sha });
    } catch (error) {
      // 404 → الملف غير موجود بعد
      if (error.message.includes('404')) {
        return res.status(404).json({ message: 'الملف غير موجود بعد في المستودع.' });
      }
      return res.status(500).json({ error: error.message });
    }
  }

  // ======== POST ========
  if (req.method === 'POST') {
    try {
      const { content, sha } = req.body;
      const url = `${API_BASE}/repos/${GITHUB_USERNAME}/${REPO_NAME}/contents/${FILE_PATH}`;

      const result = await apiRequest(url, 'PUT', {
        message: `Data update: ${new Date().toISOString()}`,
        content,                  // Base64
        ...(sha ? { sha } : {}),  // نمرر sha فقط إذا وُجد
        branch: GIT_BRANCH
      }, GITHUB_PAT);

      return res.status(200).json({
        message: 'تم التحديث بنجاح',
        commit: result.commit.sha
      });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  // أي Method أخرى غير مدعومة
  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).end(`Method ${req.method} Not Allowed`);
}
