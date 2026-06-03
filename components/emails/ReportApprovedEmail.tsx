import {
  Html, Head, Body, Container, Section,
  Text, Link, Hr, Row, Column, Font, Img,
} from '@react-email/components'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://gpdashboard.flashyourmeme.com'

export type ReportApprovedEmailProps = {
  partnerName:  string
  branchName:   string
  period:       string   // e.g. "April 2025"
  amount:       string   // e.g. "฿45,000.00"
  approvedDate: string   // e.g. "29 May 2025"
  reportUrl:    string
}

export function ReportApprovedEmail({
  partnerName  = 'Partner',
  branchName   = 'Branch',
  period       = 'April 2025',
  amount       = '฿0.00',
  approvedDate = '',
  reportUrl    = '#',
}: ReportApprovedEmailProps) {
  return (
    <Html lang="th">
      <Head>
        <Font
          fontFamily="Google Sans"
          fallbackFontFamily="Helvetica"
          webFont={{
            url: 'https://fonts.gstatic.com/s/googlesans/v58/4UaGrENHsxJlGDuGo1OIlL3Kwp5MKg.woff2',
            format: 'woff2',
          }}
          fontWeight={400}
          fontStyle="normal"
        />
      </Head>
      <Body style={body}>
        <Container style={container}>

          {/* Header */}
          <Section style={header}>
            <Row>
              <Column style={{ verticalAlign: 'middle', width: '44px', paddingRight: '12px' }}>
                <Img
                  src={`${APP_URL}/logo-fym-white.svg`}
                  alt="FLASHYOURMEME"
                  width="44"
                  height="30"
                  style={{ display: 'block' }}
                />
              </Column>
              <Column style={{ verticalAlign: 'middle' }}>
                <Text style={headerLogo}>FLASHYOURMEME CO., LTD.</Text>
                <Text style={headerTag}>GP Dashboard</Text>
              </Column>
            </Row>
          </Section>

          {/* Hero */}
          <Section style={hero}>
            <Section style={iconWrapGreen}>
              <Text style={iconText}>&#10003;</Text>
            </Section>
            <Text style={h1}>รายงานได้รับการอนุมัติแล้ว</Text>
            <Text style={heroBody}>
              สวัสดีคุณ <strong>{partnerName}</strong> — รายงานประจำเดือนของคุณได้รับการตรวจสอบและอนุมัติเรียบร้อยแล้ว
            </Text>
          </Section>

          {/* Amount */}
          <Section style={amountBox}>
            <Text style={amountLabel}>ยอดที่ได้รับ</Text>
            <Text style={amountValue}>{amount}</Text>
            <Text style={amountSub}>Net payout หลังหักค่าธรรมเนียม</Text>
          </Section>

          {/* Details grid */}
          <Section style={detailsBox}>
            <Row>
              <Column style={detailCell}>
                <Text style={detailKey}>รายงานเดือน</Text>
                <Text style={detailVal}>{period}</Text>
              </Column>
              <Column style={{ ...detailCell, borderLeft: '1px solid #e2e8f0' }}>
                <Text style={detailKey}>สาขา</Text>
                <Text style={detailVal}>{branchName}</Text>
              </Column>
            </Row>
            <Row style={{ borderTop: '1px solid #e2e8f0' }}>
              <Column style={detailCell}>
                <Text style={detailKey}>สถานะ</Text>
                <Text style={{ ...detailVal, ...pillGreen }}>Approved</Text>
              </Column>
              <Column style={{ ...detailCell, borderLeft: '1px solid #e2e8f0' }}>
                <Text style={detailKey}>วันที่อนุมัติ</Text>
                <Text style={detailVal}>{approvedDate}</Text>
              </Column>
            </Row>
          </Section>

          {/* CTA */}
          <Section style={ctaSection}>
            <Link href={reportUrl} style={ctaBlue}>ดูรายงานฉบับเต็ม &rarr;</Link>
          </Section>

          <Hr style={divider} />

          {/* Note */}
          <Section style={noteSection}>
            <Text style={noteText}>
              ระบบจะดำเนินการโอนเงินภายใน <strong>3&ndash;5 วันทำการ</strong> นับจากวันที่อนุมัติ
              หากมีข้อสงสัยกรุณาติดต่อทีมงาน
            </Text>
          </Section>

          {/* Footer */}
          <Section style={footer}>
            <Text style={footerText}>FLASHYOURMEME CO., LTD. &middot; GP Dashboard</Text>
          </Section>

        </Container>
      </Body>
    </Html>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const body: React.CSSProperties = {
  backgroundColor: '#f1f5f9',
  fontFamily: "'Google Sans', 'Helvetica Neue', Arial, sans-serif",
  margin: 0,
  padding: '32px 0',
}
const container: React.CSSProperties = {
  maxWidth: '560px',
  margin: '0 auto',
  backgroundColor: '#ffffff',
  borderRadius: '12px',
  overflow: 'hidden',
  boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
}
const header: React.CSSProperties = {
  backgroundColor: '#06080F',
  padding: '20px 32px',
  borderBottom: '1px solid rgba(255,255,255,0.06)',
}
const headerLogo: React.CSSProperties = {
  margin: 0, fontSize: '15px', fontWeight: 700,
  color: '#ffffff', letterSpacing: '-0.01em',
}
const headerTag: React.CSSProperties = {
  margin: '2px 0 0', fontSize: '10px', fontWeight: 500,
  color: '#3B82F6', letterSpacing: '0.08em', textTransform: 'uppercase',
}
const hero: React.CSSProperties = { padding: '32px 32px 20px' }
const iconWrapGreen: React.CSSProperties = {
  width: '44px', height: '44px', borderRadius: '12px',
  backgroundColor: '#dcfce7', textAlign: 'center', marginBottom: '16px',
}
const iconText: React.CSSProperties = {
  margin: 0, fontSize: '20px', fontWeight: 700,
  color: '#16a34a', lineHeight: '44px',
}
const h1: React.CSSProperties = {
  margin: '0 0 8px', fontSize: '22px', fontWeight: 700,
  color: '#0f172a', letterSpacing: '-0.02em',
}
const heroBody: React.CSSProperties = {
  margin: 0, fontSize: '14px', color: '#64748b', lineHeight: 1.65,
}
const amountBox: React.CSSProperties = {
  margin: '0 32px 24px',
  backgroundColor: '#f8fafc',
  borderRadius: '12px',
  padding: '20px 24px',
  border: '1px solid #e2e8f0',
}
const amountLabel: React.CSSProperties = {
  margin: '0 0 6px', fontSize: '10px', fontWeight: 500,
  letterSpacing: '0.1em', textTransform: 'uppercase', color: '#94a3b8',
}
const amountValue: React.CSSProperties = {
  margin: 0, fontSize: '34px', fontWeight: 700,
  color: '#0f172a', letterSpacing: '-0.03em',
}
const amountSub: React.CSSProperties = {
  margin: '4px 0 0', fontSize: '12px', color: '#94a3b8',
}
const detailsBox: React.CSSProperties = {
  margin: '0 32px 24px',
  border: '1px solid #e2e8f0',
  borderRadius: '10px',
  overflow: 'hidden',
}
const detailCell: React.CSSProperties = {
  padding: '14px 16px', backgroundColor: '#ffffff', width: '50%',
}
const detailKey: React.CSSProperties = {
  margin: '0 0 4px', fontSize: '10px', fontWeight: 500,
  letterSpacing: '0.08em', textTransform: 'uppercase', color: '#94a3b8',
}
const detailVal: React.CSSProperties = {
  margin: 0, fontSize: '14px', fontWeight: 500, color: '#1e293b',
}
const pillGreen: React.CSSProperties = {
  display: 'inline-block', padding: '2px 10px', borderRadius: '20px',
  backgroundColor: '#dcfce7', color: '#16a34a',
  fontSize: '11px', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase',
}
const ctaSection: React.CSSProperties = { padding: '4px 32px 24px' }
const ctaBlue: React.CSSProperties = {
  display: 'inline-block', padding: '13px 28px', borderRadius: '10px',
  backgroundColor: '#2563eb', color: '#ffffff',
  fontSize: '14px', fontWeight: 600, textDecoration: 'none', letterSpacing: '0.01em',
}
const divider: React.CSSProperties = { margin: '0 32px 20px', borderColor: '#f1f5f9' }
const noteSection: React.CSSProperties = { padding: '0 32px 28px' }
const noteText: React.CSSProperties = {
  margin: 0, fontSize: '13px', color: '#94a3b8', lineHeight: 1.75,
}
const footer: React.CSSProperties = {
  backgroundColor: '#f8fafc',
  borderTop: '1px solid #e2e8f0',
  padding: '16px 32px',
}
const footerText: React.CSSProperties = {
  margin: 0, fontSize: '11px', fontWeight: 600,
  color: '#94a3b8', letterSpacing: '0.05em', textTransform: 'uppercase',
}
