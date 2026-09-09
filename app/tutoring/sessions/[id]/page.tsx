import TutoringSessionRoom from "@/app/_components/TutoringSessionRoom";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function TutoringSessionPage({ params }: PageProps) {
  const { id } = await params;

  return <TutoringSessionRoom bookingId={id} />;
}
