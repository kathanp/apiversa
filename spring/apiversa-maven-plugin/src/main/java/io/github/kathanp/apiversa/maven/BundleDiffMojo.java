package io.github.kathanp.apiversa.maven;

import java.io.File;
import org.apache.maven.plugin.AbstractMojo;
import org.apache.maven.plugin.MojoFailureException;
import org.apache.maven.plugins.annotations.Mojo;
import org.apache.maven.plugins.annotations.Parameter;

/** Compare two bundle directories. Does not copy either directory. */
@Mojo(name = "bundle-diff", requiresProject = true)
public class BundleDiffMojo extends AbstractMojo {
    @Parameter(property = "left")
    private File left;

    @Parameter(property = "right")
    private File right;

    @Parameter(property = "out")
    private File out;

    @Override
    public void execute() throws MojoFailureException {
        if (left == null || right == null || out == null) return;
        try {
            BundleDiff.write(left.toPath(), right.toPath(), out.toPath());
        } catch (Exception exception) {
            throw new MojoFailureException(exception.getMessage(), exception);
        }
    }
}
