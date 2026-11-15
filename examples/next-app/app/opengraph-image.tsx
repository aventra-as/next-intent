import { ImageResponse } from 'next/og';
export const alt = 'next-intent — A head start on your next click.';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        padding: '64px 80px',
        background: '#fafafa',
        color: '#202020',
        fontFamily: 'sans-serif',
      }}
    >
      <div style={{ display: 'flex', fontSize: 28 }}>next-intent</div>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          fontSize: 76,
          lineHeight: 1.1,
          letterSpacing: -3,
          marginTop: 78,
        }}
      >
        <span>A head start</span>
        <span>on your next click.</span>
      </div>
      <div
        style={{ display: 'flex', fontSize: 26, color: '#666', marginTop: 32 }}
      >
        Predictive route prefetching for React and Next.js
      </div>
      <div style={{ display: 'flex', alignItems: 'center', marginTop: 60 }}>
        <div style={{ width: 400, borderTop: '3px dashed #318453' }} />
        <div
          style={{
            border: '2px solid #318453',
            color: '#226a40',
            background: '#effaf3',
            borderRadius: 12,
            padding: '18px 32px',
            fontSize: 24,
          }}
        >
          Next page →
        </div>
      </div>
    </div>,
    size,
  );
}
