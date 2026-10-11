import EntryEditor from "@/components/admin/EntryEditor";
export default async function EditEntryPage({params}:{params:Promise<{id:string}>}){const {id}=await params;return <EntryEditor id={id}/>}
