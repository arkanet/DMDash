import { SidebarButton, type SidebarButtonProps } from "@components/UI/Sidebar/SidebarButton.tsx";

type LeftSidebarButtonProps = Omit<SidebarButtonProps, "buttonClassName">;

export function LeftSidebarButton(props: LeftSidebarButtonProps) {
  return <SidebarButton {...props} buttonClassName="mx-auto w-[90%] max-w-[90%] self-center" />;
}
