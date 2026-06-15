import type { InjectionKey } from "vue";
import type { CreateStudentFeedPostInput } from "@/types/studentPost";

export type StudentPostPublishFn = (input: CreateStudentFeedPostInput) => Promise<void>;

export const studentPostPublishKey: InjectionKey<StudentPostPublishFn> = Symbol("studentPostPublish");
