import { PageEditor } from '@/components/PageEditor';

interface EditorPageProps {
  params: {
    id: string;
  };
}

export default function EditorPage({ params }: EditorPageProps) {
  return <PageEditor pageId={params.id} />;
}
