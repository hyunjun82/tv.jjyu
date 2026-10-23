/**
 * 애드센스 자동 광고 슬롯. 개발·미리보기에서는 아무것도 그리지 않는다(빈 박스 금지).
 * 실제 사이트에서는 adsbygoogle.js 가 <ins> 를 채운다. 슬롯 ID 는 애드센스에서 발급 후 넣는다.
 */
export default function AdSlot({ slot = '' }) {
  if (!slot) return <div className="ad-gap" aria-hidden="true" />;
  return (
    <div className="ad-wrap">
      <ins className="adsbygoogle" style={{ display: 'block' }} data-ad-client="ca-pub-2442517902625121" data-ad-slot={slot} data-ad-format="auto" data-full-width-responsive="true" />
      <script dangerouslySetInnerHTML={{ __html: '(adsbygoogle=window.adsbygoogle||[]).push({});' }} />
    </div>
  );
}
