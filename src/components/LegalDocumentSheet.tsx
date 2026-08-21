import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import type { LegalDoc } from '@/lib/legalContent';

interface LegalDocumentSheetProps {
  doc: LegalDoc;
  trigger: React.ReactNode;
}

export default function LegalDocumentSheet({ doc, trigger }: LegalDocumentSheetProps) {
  return (
    <Sheet>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-3xl pb-safe max-h-[85vh] flex flex-col overflow-hidden">
        <SheetHeader className="mb-2 flex-shrink-0">
          <SheetTitle>{doc.title}</SheetTitle>
          <p className="text-xs text-muted-foreground">Dernière mise à jour : {doc.updated}</p>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto pr-1 space-y-5 pb-4">
          {doc.sections.map((section, i) => (
            <div key={i} className="space-y-1.5">
              {section.heading && (
                <h3 className="text-sm font-bold text-foreground">{section.heading}</h3>
              )}
              {section.body.map((p, j) => (
                <p key={j} className="text-sm leading-relaxed text-muted-foreground whitespace-pre-line">
                  {p}
                </p>
              ))}
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
