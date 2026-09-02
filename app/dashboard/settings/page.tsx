import { Building2 } from "lucide-react";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Card } from "@/components/ui/Card";
import { Divider } from "@/components/ui/Divider";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";

export default function SettingsPage() {
  return (
    <div>
      <div className="flex items-center gap-2">
        <h1 className="text-xl font-semibold tracking-tight text-text">
          Settings
        </h1>
        <Badge variant="neutral">Preview</Badge>
      </div>
      <p className="mt-1.5 max-w-lg text-sm text-text-secondary">
        Business details and preferences will be editable here once account
        settings are built. This is a preview of the layout.
      </p>

      <Card className="mt-6 max-w-lg">
        <SectionHeading
          title="Business profile"
          description="Shown across Signal and used to personalize your dashboard."
        />
        <div className="mt-5 flex flex-col gap-4">
          <div>
            <label className="text-[13px] font-medium text-text" htmlFor="business-name">
              Business name
            </label>
            <Input
              id="business-name"
              className="mt-1.5"
              placeholder="Your business name"
              disabled
            />
          </div>

          <div>
            <label className="text-[13px] font-medium text-text" htmlFor="business-about">
              About
            </label>
            <Textarea
              id="business-about"
              className="mt-1.5"
              placeholder="A short description customers might recognize"
              disabled
            />
          </div>

          <div>
            <span className="text-[13px] font-medium text-text">
              Dashboard language
            </span>
            <Select defaultValue="en" disabled>
              <SelectTrigger className="mt-1.5" aria-label="Dashboard language">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="hi">Hindi</SelectItem>
                <SelectItem value="te">Telugu</SelectItem>
                <SelectItem value="ta">Tamil</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Divider className="my-5" />

        <div className="flex items-center gap-2 text-[13px] text-text-tertiary">
          <Building2 className="h-3.5 w-3.5" aria-hidden="true" />
          Editable once account settings are built.
        </div>
      </Card>
    </div>
  );
}
