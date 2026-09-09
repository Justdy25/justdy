import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";

interface TutoringBookingConfirmedEmailProps {
  username: string;
  subject: string;
  date: string;
  time: string;
  amountPaid: string;
  tutoringUrl: string;
}

export default function TutoringBookingConfirmedEmail({
  username,
  subject,
  date,
  time,
  amountPaid,
  tutoringUrl,
}: TutoringBookingConfirmedEmailProps) {
  return (
    <Html>
      <Head />

      <Preview>Your Justdy tutoring session is confirmed</Preview>

      <Body
        style={{
          margin: 0,
          padding: "40px 16px",
          backgroundColor: "#f8fafc",
          fontFamily:
            "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          color: "#0f172a",
        }}
      >
        <Container
          style={{
            maxWidth: "600px",
            margin: "0 auto",
            backgroundColor: "#ffffff",
            borderRadius: "16px",
            border: "1px solid #e2e8f0",
            overflow: "hidden",
          }}
        >
          <Section
            style={{
              padding: "28px 32px",
              backgroundColor: "#0f172a",
            }}
          >
            <Text
              style={{
                margin: 0,
                color: "#ffffff",
                fontSize: "22px",
                fontWeight: 700,
              }}
            >
              Justdy
            </Text>

            <Text
              style={{
                margin: "6px 0 0",
                color: "#cbd5e1",
                fontSize: "13px",
              }}
            >
              Live tutoring
            </Text>
          </Section>

          <Section style={{ padding: "36px 32px" }}>
            <Heading
              style={{
                margin: "0 0 12px",
                fontSize: "28px",
                lineHeight: "36px",
                fontWeight: 700,
                color: "#0f172a",
              }}
            >
              Your tutoring session is confirmed
            </Heading>

            <Text
              style={{
                margin: "0 0 24px",
                fontSize: "16px",
                lineHeight: "26px",
                color: "#475569",
              }}
            >
              Hi {username},
            </Text>

            <Text
              style={{
                margin: "0 0 24px",
                fontSize: "15px",
                lineHeight: "24px",
                color: "#475569",
              }}
            >
              Your Justdy live tutoring session has been successfully booked and
              paid for. We look forward to seeing you in your private tutoring
              classroom.
            </Text>

            <Section
              style={{
                padding: "20px",
                borderRadius: "12px",
                backgroundColor: "#f8fafc",
                border: "1px solid #e2e8f0",
              }}
            >
              <Text
                style={{
                  margin: "0 0 8px",
                  fontSize: "12px",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "#64748b",
                }}
              >
                Session details
              </Text>

              <Text
                style={{
                  margin: "0 0 12px",
                  fontSize: "18px",
                  fontWeight: 700,
                  color: "#0f172a",
                }}
              >
                {subject}
              </Text>

              <Text
                style={{
                  margin: "6px 0",
                  fontSize: "14px",
                  lineHeight: "22px",
                  color: "#475569",
                }}
              >
                <strong>Date:</strong> {date}
              </Text>

              <Text
                style={{
                  margin: "6px 0",
                  fontSize: "14px",
                  lineHeight: "22px",
                  color: "#475569",
                }}
              >
                <strong>Time:</strong> {time}
              </Text>

              <Text
                style={{
                  margin: "6px 0 0",
                  fontSize: "14px",
                  lineHeight: "22px",
                  color: "#475569",
                }}
              >
                <strong>Amount paid:</strong> ${amountPaid}
              </Text>
            </Section>

            <Section style={{ marginTop: "28px", textAlign: "center" }}>
              <Button
                href={tutoringUrl}
                style={{
                  display: "inline-block",
                  padding: "13px 22px",
                  borderRadius: "10px",
                  backgroundColor: "#0f172a",
                  color: "#ffffff",
                  fontSize: "14px",
                  fontWeight: 700,
                  textDecoration: "none",
                }}
              >
                View My Tutoring Sessions
              </Button>
            </Section>

            <Hr
              style={{
                margin: "32px 0 24px",
                borderColor: "#e2e8f0",
              }}
            />

            <Text
              style={{
                margin: 0,
                fontSize: "13px",
                lineHeight: "21px",
                color: "#64748b",
              }}
            >
              Your live tutoring session will take place through Justdy&apos;s
              private online classroom, where you can connect with your tutor,
              communicate through video and audio, and work together on a shared
              whiteboard.
            </Text>

            <Text
              style={{
                margin: "16px 0 0",
                fontSize: "13px",
                lineHeight: "21px",
                color: "#64748b",
              }}
            >
              Please keep this email for your records.
            </Text>
          </Section>

          <Section
            style={{
              padding: "20px 32px",
              backgroundColor: "#f8fafc",
              borderTop: "1px solid #e2e8f0",
            }}
          >
            <Text
              style={{
                margin: 0,
                textAlign: "center",
                fontSize: "12px",
                color: "#94a3b8",
              }}
            >
              © {new Date().getFullYear()} Justdy. All rights reserved.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
