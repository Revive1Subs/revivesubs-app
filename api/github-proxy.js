// api/github-proxy.js - نسخة محسّنة للتعامل مع الملفات الكبيرة

async function apiRequest(url, method = 'GET', body = null, pat) {
  const headers = {
    'Authorization': `token ${pat}`,
    'Accept': 'application/vnd.github.v3+json',
  };
  if (body) {
    headers['Content-Type'] = 'application/json';
  }
  const response = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : null });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(`GitHub API Error: ${response.status} ${errorData.message || ''}`);
  }
  if (response.status === 204 || response.status === 201) return {}; // No content on success
  return response.json();
}

export default async function handler(req, res) {
  const GITHUB_USERNAME = 'Revive1Subs';
  const REPO_NAME = 'revivesubs-data';
  const FILE_PATH = 'data.json';
  const GITHUB_PAT = process.env.GITHUB_PAT;
  const API_BASE = 'https://api.github.com';

  // إعدادات CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // --- منطق جلب البيانات (الاستيراد) المحسّن ---
  if (req.method === 'GET') {
    try {
      const contentsUrl = `${API_BASE}/repos/${GITHUB_USERNAME}/${REPO_NAME}/contents/${FILE_PATH}`;
      const fileMeta = await apiRequest(contentsUrl, 'GET', null, GITHUB_PAT).catch(e => {
        if (e.message.includes('404')) return null; // الملف غير موجود
        throw e;
      });

      if (!fileMeta || !fileMeta.sha) {
        return res.status(404).json({ message: "الملف غير موجود في المستودع." });
      }

      // إذا كان الملف كبيرًا، فإن حقل المحتوى لن يكون موجودًا.
      // سنستخدم الـ blob API لجلب المحتوى
      const blobUrl = `${API_BASE}/repos/${GITHUB_USERNAME}/${REPO_NAME}/git/blobs/${fileMeta.sha}`;
      const blobData = await apiRequest(blobUrl, 'GET', null, GITHUB_PAT);
      
      if(!blobData.content){
         return res.status(200).json({ content: null, message: "الملف موجود لكنه فارغ." });
      }
      
      // إرسال الـ sha مع المحتوى، لأننا سنحتاجه عند التصدير
      res.status(200).json({ content: blobData.content, sha: fileMeta.sha });

    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
  // --- منطق تحديث البيانات (التصدير) المحسّن ---
  else if (req.method === 'POST') {
    try {
      const { content, sha: clientSha } = req.body; // المحتوى المشفر + sha القديم
      
      const branch = 'main'; // أو 'master' حسب اسم الفرع الرئيسي

      // الخطوة 1: إنشاء "blob" جديد بالبيانات الجديدة
      const blobData = await apiRequest(`${API_BASE}/repos/${GITHUB_USERNAME}/${REPO_NAME}/git/blobs`, 'POST', {
        content: content,
        encoding: 'base64'
      }, GITHUB_PAT);
      const newBlobSha = blobData.sha;

      // الخطوة 2: الحصول على أحدث commit
      const refData = await apiRequest(`${API_BASE}/repos/${GITHUB_USERNAME}/${REPO_NAME}/git/ref/heads/${branch}`, 'GET', null, GITHUB_PAT);
      const latestCommitSha = refData.object.sha;

      // الخطوة 3: إنشاء "tree" جديد
      const treeData = await apiRequest(`${API_BASE}/repos/${GITHUB_USERNAME}/${REPO_NAME}/git/trees`, 'POST', {
        base_tree: latestCommitSha,
        tree: [{
          path: FILE_PATH,
          mode: '100644', // وضع الملف (blob)
          type: 'blob',
          sha: newBlobSha
        }]
      }, GITHUB_PAT);
      const newTreeSha = treeData.sha;

      // الخطوة 4: إنشاء commit جديد
      const newCommitData = await apiRequest(`${API_BASE}/repos/${GITHUB_USERNAME}/${REPO_NAME}/git/commits`, 'POST', {
        message: `Data update: ${new Date().toISOString()}`,
        tree: newTreeSha,
        parents: [latestCommitSha]
      }, GITHUB_PAT);
      const newCommitSha = newCommitData.sha;

      // الخطوة 5: تحديث مرجع الفرع ليشير إلى الـ commit الجديد
      await apiRequest(`${API_BASE}/repos/${GITHUB_USERNAME}/${REPO_NAME}/git/refs/heads/${branch}`, 'PATCH', {
        sha: newCommitSha
      }, GITHUB_PAT);

      res.status(200).json({ message: "تم التحديث بنجاح." });
      
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  } else {
    res.setHeader('Allow', ['GET', 'POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
