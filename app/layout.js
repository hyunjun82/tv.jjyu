import './globals.css';

const SITE_URL = 'https://tv.jjyu.co.kr';
const SITE_NAME = 'TVDAY';

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: '방송 이슈와 출연진, 회차별 다시보기 | TVDAY', template: '%s | TVDAY' },
  description: '오늘의 방송 이슈와 드라마·예능 출연진·회차 정보를 방송사·OTT 공식 자료와 보도 기준으로 정리하고, 회차별 다시보기·공식 영상으로 바로 연결합니다.',
  keywords: ['편성표', '출연진', '몇부작', '다시보기', '재방송', '나는솔로', '드라마 기본정보'],
  openGraph: { type: 'website', locale: 'ko_KR', siteName: SITE_NAME },
  robots: { index: true, follow: true },
  applicationName: 'TVDAY',
  icons: { icon: [{ url: '/favicon.ico', sizes: '48x48' }, { url: '/favicon-32.png', sizes: '32x32', type: 'image/png' }, { url: '/icon-96.png', sizes: '96x96', type: 'image/png' }, { url: '/icon-192.png', sizes: '192x192', type: 'image/png' }, { url: '/favicon.svg', type: 'image/svg+xml' }], apple: [{ url: '/apple-touch-icon.png', sizes: '180x180' }] },
  alternates: { types: { 'application/rss+xml': `${SITE_URL}/rss.xml` } },
  manifest: '/site.webmanifest',
};
export const viewport = { themeColor: '#6a3df5' };

const siteJsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    { '@type': 'WebSite', '@id': `${SITE_URL}/#website`, url: SITE_URL, name: SITE_NAME, description: '드라마·예능 편성·출연진·다시보기 정보', inLanguage: 'ko-KR' },
    { '@type': 'Organization', '@id': `${SITE_URL}/#org`, name: SITE_NAME, url: SITE_URL },
  ],
};

const NAV = [['오늘의 이슈', '/cat/issue/'], ['방송 맛집', '/cat/food/'], ['예능', '/cat/variety/'], ['드라마', '/cat/drama/'], ['나는솔로', '/cat/nasolo/']];

export default function RootLayout({ children }) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700;900&family=Gothic+A1:wght@700;800;900&display=swap" />
        <meta name="naver-site-verification" content="a98e9b91e35a925b17294b66141d74ec2dd1c0d6" />
        <meta name="DaumWebMasterTool" content="8a096d27ae1fea3ec2f2d6f4a95c283e6378acb3b363bb4f4dac6af833825300:WoYFtMaR84eZ7MaX1Xjw9A==" />
        {/* 빙 msvalidate.01 은 영문 원문 값을 받은 뒤 추가 */}
        <link rel="preconnect" href="https://pagead2.googlesyndication.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://fundingchoicesmessages.google.com" crossOrigin="anonymous" />
        {/* Offerwall 선로드 — 애드센스 뒤에 붙이면 표시가 2초 넘게 밀린다(퀴즈에서 실측). quiz/game/ticket 과 동일 */}
        <script async src="https://fundingchoicesmessages.google.com/i/ca-pub-2442517902625121?ers=1" />
        <script dangerouslySetInnerHTML={{ __html: "(function(){function s(){if(!window.frames['googlefcPresent']){if(document.body){var i=document.createElement('iframe');i.style='width:0;height:0;border:none;z-index:-1000;left:-1000px;top:-1000px;';i.style.display='none';i.name='googlefcPresent';document.body.appendChild(i);}else{setTimeout(s,0);}}}s();})();" }} />
        <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-2442517902625121" crossOrigin="anonymous" />
        {/* 자동 광고(전면 광고 포함) 페이지 단위 활성화 — 애드센스 사이트 설정에서 전면 광고를 켜 두면 사이트 안 페이지 이동(/go/ 포함) 때 뜬다 */}
        <script dangerouslySetInnerHTML={{ __html: "(adsbygoogle=window.adsbygoogle||[]).push({google_ad_client:'ca-pub-2442517902625121',enable_page_level_ads:true});" }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(siteJsonLd) }} />
      </head>
      <body>
        <header className="gnb"><div className="wrap">
          <a className="logo" href="/"><i />TVDAY</a>
          <nav className="cats">{NAV.map(([l, h]) => <a key={l} href={h}>{l}</a>)}</nav>
          <div className="search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>프로그램 · 출연자 · 이슈 검색</div>
        </div></header>
        {children}
        <footer><div className="wrap">
          <div>TVDAY는 방송사·OTT가 공개한 편성·출연 정보를 정리해 제공하며, 영상 시청은 각 공식 서비스에서 이루어집니다. 출연자 정보는 방송에서 공개된 범위만 다룹니다. 프로그램명·이미지의 권리는 각 방송사·제작사에 있습니다.</div>
          <div>© {new Date().getFullYear()} tv.jjyu.co.kr</div>
        </div></footer>
      </body>
    </html>
  );
}
