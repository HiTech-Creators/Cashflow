import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function Privacy() {
  return (
    <div className="container mx-auto px-4 py-10">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/">Home</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Privacy Policy</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Privacy Policy</CardTitle>
          <CardDescription>Last updated: {new Date().toLocaleDateString()}</CardDescription>
        </CardHeader>
        <CardContent className="prose prose-sm dark:prose-invert max-w-none">
          <p>
            We respect your privacy. This policy explains what information we collect, how we use it, and your choices.
          </p>
          <h3 className="mt-4">Information We Collect</h3>
          <ul>
            <li>Account data (name, email)</li>
            <li>Usage data (interactions, device, analytics)</li>
            <li>Integration data (with your permission)</li>
          </ul>
          <h3 className="mt-4">How We Use Information</h3>
          <ul>
            <li>Provide and improve Novatech services</li>
            <li>Security, debugging, and fraud prevention</li>
            <li>Customer support and communications</li>
          </ul>
          <h3 className="mt-4">Data Sharing</h3>
          <p>
            We do not sell personal data. We share information with trusted subprocessors to operate our services, under strict agreements.
          </p>
          <h3 className="mt-4">Data Retention</h3>
          <p>
            We retain data only as long as necessary for the purposes described and to comply with legal obligations.
          </p>
          <h3 className="mt-4">Your Rights</h3>
          <ul>
            <li>Access, correct, or delete your data</li>
            <li>Export your data</li>
            <li>Object or restrict processing where applicable</li>
          </ul>
          <h3 className="mt-4">Contact</h3>
          <p>
            For questions or requests, contact privacy@novatech.app.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}


